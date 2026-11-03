import React, { useState } from "react";
import { Check, ClipboardText, Copy, Trash, X } from "./icons";
import { ClipboardHistoryEntry } from "../types/vault";

interface ClipboardHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entries: ClipboardHistoryEntry[];
  accentHex: string;
  onClearHistory: () => void;
  onNotify: (message: string) => void;
}

export const ClipboardHistoryDrawer: React.FC<ClipboardHistoryDrawerProps> = ({
  isOpen,
  onClose,
  entries,
  accentHex,
  onClearHistory,
  onNotify,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleRecopy = async (entry: ClipboardHistoryEntry) => {
    try {
      await navigator.clipboard.writeText(entry.payload);
      setCopiedId(entry.id);
      onNotify(`Re-copied "${entry.label}" (${entry.tokens} tokens)`);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      onNotify("Failed to copy");
    }
  };

  const toggleSelectEntry = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleCopyCombinedSelection = async () => {
    const chosen = entries.filter((e) => selectedIds.includes(e.id));
    if (chosen.length === 0) return;
    const combinedPayload = chosen.map((c) => c.payload).join("\n\n---\n\n");
    try {
      await navigator.clipboard.writeText(combinedPayload);
      onNotify(`Copied combined multi-block payload (${chosen.length} items) for Argon!`);
      setSelectedIds([]);
    } catch {
      onNotify("Failed to copy combined payload");
    }
  };

  const totalSelectedTokens = entries
    .filter((e) => selectedIds.includes(e.id))
    .reduce((sum, e) => sum + e.tokens, 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Agent Clipboard and Multi-Copy Sheet"
      onClick={onClose}
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-(--md-sys-color-surface-container) border-l border-(--md-sys-color-outline-variant) rounded-l-[28px] h-full flex flex-col justify-between shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-(--md-sys-color-outline-variant)">
          <div className="flex items-center gap-3">
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center text-white"
              style={{ backgroundColor: accentHex }}
            >
              <ClipboardText className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Agent Clipboard & Multi-Copy Sheet
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Inspect recent copies or check multiple items to merge into one prompt.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Multi-Select Merge Bar */}
        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between px-6 py-3 m3-primary-container border-b border-(--md-sys-color-outline-variant) text-xs">
            <span className="font-mono tabular-nums font-medium">
              {selectedIds.length} selected · {totalSelectedTokens} total tokens
            </span>
            <button
              type="button"
              onClick={handleCopyCombinedSelection}
              style={{ backgroundColor: accentHex }}
              className="px-4 py-1.5 rounded-full text-xs font-semibold text-white cursor-pointer"
            >
              Copy Merged Payload
            </button>
          </div>
        )}

        {/* History Entries */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {entries.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Your clipboard history is empty. Click any Copy button across Prompts, Tech Stacks, or
              Code Lessons to log payloads here.
            </div>
          ) : (
            entries.map((entry) => {
              const isCopied = copiedId === entry.id;
              const isChecked = selectedIds.includes(entry.id);

              return (
                <div
                  key={entry.id}
                  className={`p-4 rounded-2xl border transition-colors ${
                    isChecked
                      ? "m3-tonal-pill border-transparent"
                      : "bg-(--md-sys-color-surface-container-low) border-(--md-sys-color-outline-variant)"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100 truncate cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelectEntry(entry.id)}
                        style={{ accentColor: accentHex }}
                        className="rounded"
                      />
                      <span className="truncate">{entry.label}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleRecopy(entry)}
                      className="flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium bg-(--md-sys-color-surface) border border-(--md-sys-color-outline-variant) text-slate-700 dark:text-slate-200 hover:bg-(--md-sys-color-surface-container-high) shrink-0 cursor-pointer"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Re-Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono tabular-nums mb-2">
                    <span>{entry.sourceKind}</span>
                    <span>·</span>
                    <span>{entry.tokens} tokens</span>
                    <span>·</span>
                    <span>{new Date(entry.copiedAt).toLocaleTimeString()}</span>
                  </div>

                  <pre className="p-3 rounded-xl bg-(--md-sys-color-surface-container-lowest) border border-(--md-sys-color-outline-variant) font-mono text-[11px] text-slate-600 dark:text-slate-300 max-h-24 overflow-y-auto whitespace-pre-wrap">
                    <code>{entry.payload}</code>
                  </pre>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-(--md-sys-color-surface-container-low) border-t border-(--md-sys-color-outline-variant)">
          {entries.length > 0 ? (
            <button
              type="button"
              onClick={onClearHistory}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-500 cursor-pointer"
            >
              <Trash className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          ) : (
            <span className="text-xs text-slate-400">Session History</span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 rounded-full text-xs font-medium m3-tonal-pill cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
