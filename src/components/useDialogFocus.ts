import { RefObject, useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute("aria-hidden") && el.getClientRects().length > 0,
  );
}

/**
 * Modal dialog focus behaviour:
 * - moves focus into the dialog when it opens (an `autoFocus` element wins, else the first
 *   focusable control, else the dialog itself),
 * - keeps Tab / Shift+Tab inside the dialog,
 * - closes on Escape,
 * - returns focus to the element that opened the dialog when it closes.
 */
export function useDialogFocus(
  ref: RefObject<HTMLElement | null>,
  isOpen: boolean,
  onClose: () => void,
): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const container = ref.current;
    if (!container) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (!container.contains(document.activeElement)) {
      const first = focusableIn(container)[0];
      if (first) {
        first.focus();
      } else {
        if (!container.hasAttribute("tabindex")) container.setAttribute("tabindex", "-1");
        container.focus();
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusableIn(container);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !container.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !container.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };

    container.addEventListener("keydown", onKeyDown);
    return () => {
      container.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [isOpen, ref]);
}
