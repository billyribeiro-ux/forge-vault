use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, RunEvent, WindowEvent};
use tauri_plugin_dialog::DialogExt;

/// Set once the app is really exiting. Until then, closing the window only hides it so the app
/// keeps running in the Dock.
static QUITTING: AtomicBool = AtomicBool::new(false);

/// Event asking the webview to flush pending IndexedDB writes before the process exits.
const FLUSH_BEFORE_EXIT_EVENT: &str = "forgevault://flush-before-exit";

/// How long a quit waits for the webview to confirm its writes are flushed.
const EXIT_FLUSH_TIMEOUT: Duration = Duration::from_secs(3);

/// Upper bound for one exported file. A full vault backup is far below this.
const MAX_EXPORT_BYTES: usize = 256 * 1024 * 1024;

/// Reduces a suggested file name to a single safe path component.
fn sanitize_file_name(raw: &str) -> String {
    let cleaned: String = raw
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '\0' => '-',
            c if c.is_control() => '-',
            c => c,
        })
        .collect();
    let trimmed = cleaned.trim().trim_start_matches('.').trim();
    let limited: String = trimmed.chars().take(200).collect();
    if limited.is_empty() {
        "forgevault-export.txt".to_owned()
    } else {
        limited
    }
}

/// Writes `contents` to `path` through a temporary sibling file and a rename, so an interrupted
/// write never leaves a truncated file at the destination.
fn write_atomically(path: &Path, contents: &[u8]) -> std::io::Result<()> {
    let parent = path.parent().ok_or_else(|| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "destination has no parent directory",
        )
    })?;
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("export");
    let tmp_path = parent.join(format!(
        ".{file_name}.forgevault-{}.tmp",
        std::process::id()
    ));

    let result = (|| {
        let mut file = fs::File::create(&tmp_path)?;
        file.write_all(contents)?;
        file.sync_all()?;
        fs::rename(&tmp_path, path)
    })();

    if result.is_err() {
        // Best effort: the temp file may not exist if creation itself failed.
        let _ = fs::remove_file(&tmp_path);
    }
    result
}

/// Shows the native save panel and writes `contents` to the chosen file.
///
/// The webview only suggests a file name; the user picks the location in the system dialog, so
/// the frontend can never write to an arbitrary path. Returns the saved path, or `None` when the
/// user cancels.
#[tauri::command]
async fn export_text_file(
    app: AppHandle,
    suggested_name: String,
    contents: String,
) -> Result<Option<String>, String> {
    if contents.len() > MAX_EXPORT_BYTES {
        return Err(format!(
            "export is {} bytes, above the {} byte limit",
            contents.len(),
            MAX_EXPORT_BYTES
        ));
    }
    let file_name = sanitize_file_name(&suggested_name);

    tauri::async_runtime::spawn_blocking(move || {
        let mut dialog = app
            .dialog()
            .file()
            .set_file_name(&file_name)
            .set_can_create_directories(true);
        if let Some(dir) = app.path().download_dir().ok().filter(|d| d.is_dir()) {
            dialog = dialog.set_directory(dir);
        }
        let Some(chosen) = dialog.blocking_save_file() else {
            return Ok(None);
        };
        let path: PathBuf = chosen
            .into_path()
            .map_err(|err| format!("unsupported save location: {err}"))?;
        write_atomically(&path, contents.as_bytes())
            .map_err(|err| format!("could not write {}: {err}", path.display()))?;
        Ok(Some(path.display().to_string()))
    })
    .await
    .map_err(|err| format!("export task failed: {err}"))?
}

/// Called by the webview once pending writes are flushed after a quit request.
#[tauri::command]
fn confirm_exit(app: AppHandle) {
    QUITTING.store(true, Ordering::SeqCst);
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![export_text_file, confirm_exit])
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if !QUITTING.load(Ordering::SeqCst) {
                    api.prevent_close();
                    if let Err(err) = window.hide() {
                        eprintln!("failed to hide ForgeVault window: {err}");
                    }
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building ForgeVault Tauri application");

    app.run(|app_handle, event| match event {
        // A user quit (Cmd+Q, Dock > Quit) arrives without an exit code. Hold it, let the webview
        // flush pending writes, and exit when it confirms or after a timeout.
        RunEvent::ExitRequested {
            code: None, api, ..
        } if !QUITTING.swap(true, Ordering::SeqCst) => {
            api.prevent_exit();
            if let Err(err) = app_handle.emit(FLUSH_BEFORE_EXIT_EVENT, ()) {
                eprintln!("failed to ask the webview to flush before exit: {err}");
                app_handle.exit(0);
                return;
            }
            let handle = app_handle.clone();
            std::thread::spawn(move || {
                std::thread::sleep(EXIT_FLUSH_TIMEOUT);
                eprintln!("ForgeVault exit flush timed out; exiting");
                handle.exit(0);
            });
        }
        RunEvent::ExitRequested { .. } => {
            QUITTING.store(true, Ordering::SeqCst);
        }
        #[cfg(target_os = "macos")]
        RunEvent::Reopen {
            has_visible_windows: false,
            ..
        } => {
            // Clicking the Dock icon while the window is hidden brings it back.
            if let Some(window) = app_handle.get_webview_window("main") {
                if let Err(err) = window.show() {
                    eprintln!("failed to show ForgeVault window: {err}");
                }
                if let Err(err) = window.set_focus() {
                    eprintln!("failed to focus ForgeVault window: {err}");
                }
            }
        }
        _ => {}
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_strips_path_components() {
        assert_eq!(sanitize_file_name("../../etc/passwd"), "-..-etc-passwd");
        assert_eq!(sanitize_file_name("a/b\\c:d"), "a-b-c-d");
        assert_eq!(sanitize_file_name("   "), "forgevault-export.txt");
        assert_eq!(sanitize_file_name("..."), "forgevault-export.txt");
        assert_eq!(sanitize_file_name("vault.json"), "vault.json");
    }

    #[test]
    fn sanitize_limits_length() {
        let long = "x".repeat(500);
        assert_eq!(sanitize_file_name(&long).chars().count(), 200);
    }

    #[test]
    fn atomic_write_replaces_destination_and_leaves_no_temp_file() {
        let dir = std::env::temp_dir().join(format!("forgevault-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let target = dir.join("out.json");
        fs::write(&target, b"old").unwrap();

        write_atomically(&target, b"new contents").unwrap();

        assert_eq!(fs::read(&target).unwrap(), b"new contents");
        let leftovers: Vec<_> = fs::read_dir(&dir)
            .unwrap()
            .filter_map(Result::ok)
            .filter(|e| e.file_name().to_string_lossy().ends_with(".tmp"))
            .collect();
        assert!(leftovers.is_empty());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn atomic_write_fails_for_missing_directory() {
        let target = std::env::temp_dir()
            .join("forgevault-missing-dir-does-not-exist")
            .join("x.json");
        assert!(write_atomically(&target, b"data").is_err());
    }
}
