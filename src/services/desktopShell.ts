import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { flushPendingWrites } from "./vaultStorage";

/** Event the native shell emits when the user quits, before the process exits. */
const FLUSH_BEFORE_EXIT_EVENT = "forgevault://flush-before-exit";

/** True inside the Tauri macOS app, where the title bar overlays the web content. */
export function isMacDesktopShell(): boolean {
  return isTauri() && /Mac/i.test(navigator.userAgent);
}

/**
 * Makes sure debounced IndexedDB writes reach disk:
 * - when the window is hidden (closing the window only hides it in the desktop app),
 * - when the page is unloaded (browser tab close / reload),
 * - when the user quits the desktop app: the native side waits for `confirm_exit`.
 *
 * Returns a cleanup function.
 */
export function installDesktopLifecycle(): () => void {
  const flush = () => {
    void flushPendingWrites();
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") flush();
  };
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", flush);

  let unlisten: (() => void) | null = null;
  let disposed = false;
  if (isTauri()) {
    listen(FLUSH_BEFORE_EXIT_EVENT, () => {
      flushPendingWrites()
        .catch((err: unknown) => console.error("[ForgeVault] flush before exit failed", err))
        .finally(() => {
          invoke("confirm_exit").catch((err: unknown) =>
            console.error("[ForgeVault] confirm_exit failed", err),
          );
        });
    })
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      })
      .catch((err: unknown) => console.error("[ForgeVault] could not listen for quit", err));
  }

  return () => {
    disposed = true;
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", flush);
    unlisten?.();
  };
}
