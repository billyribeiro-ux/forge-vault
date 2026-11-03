import { invoke, isTauri } from "@tauri-apps/api/core";

export type SaveFileResult = { status: "saved"; path?: string } | { status: "cancelled" };

/**
 * Saves a text file chosen by the user.
 *
 * - In the Tauri desktop app, the native side shows the macOS save panel and writes the file
 *   atomically. The webview never chooses or sees an arbitrary path. Cancel resolves `cancelled`.
 * - In a browser, the file is offered as a regular download.
 *
 * Rejects when the file could not be written, so callers can report the failure.
 */
export async function saveTextFile(
  suggestedName: string,
  contents: string,
  mimeType = "text/markdown;charset=utf-8",
): Promise<SaveFileResult> {
  if (isTauri()) {
    const path = await invoke<string | null>("export_text_file", { suggestedName, contents });
    return path ? { status: "saved", path } : { status: "cancelled" };
  }

  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = suggestedName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking synchronously can cancel the download in WebKit, so wait before releasing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return { status: "saved" };
}

/** Builds the user-facing message for a finished, cancelled, or failed save. */
export function describeSaveResult(label: string, result: SaveFileResult): string {
  if (result.status === "cancelled") return `Export of ${label} cancelled`;
  return result.path ? `Saved ${label} to ${result.path}` : `Downloaded ${label}`;
}

export function describeSaveError(label: string, err: unknown): string {
  const detail = err instanceof Error ? err.message : String(err);
  return `Could not save ${label}: ${detail}`;
}
