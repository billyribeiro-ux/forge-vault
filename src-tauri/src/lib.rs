use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{Manager, RunEvent, WindowEvent};

/// Set once the user actually chooses to quit (Dock menu "Quit", Cmd+Q).
/// Until then, closing the window only hides it so the app keeps running
/// in the Dock.
static QUITTING: AtomicBool = AtomicBool::new(false);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
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
