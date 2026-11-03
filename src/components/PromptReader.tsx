import "../services/monacoSetup";
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { Check, Copy, Folder, PencilSimple, Star, X } from "./icons";
import { CopyFormat, PromptFolder, PromptItem, ThemePreferences } from "../types/vault";
import { estimateTokenCount, formatPromptPayload } from "../services/vaultStorage";
import { registerMaterial3MonacoThemes } from "../services/monacoTheme";
import { useDialogFocus } from "./useDialogFocus";

interface PromptReaderProps {
  prompt: PromptItem;
  folders: PromptFolder[];
  initialFormat: CopyFormat;
  preferences: ThemePreferences;
  accentHex: string;
  onClose: () => void;
  onCopy: (
    prompt: PromptItem,
    values: Record<string, string>,
    format: CopyFormat,
  ) => Promise<boolean>;
  onEdit: (prompt: PromptItem) => void;
  onMove: (promptId: string, folderId: string | null) => void;
  onToggleFavorite: (id: string) => void;
}

const FORMAT_LABELS: Record<CopyFormat, string> = {
  raw: "Raw text",
  xml: "Agent XML",
  markdown: "Markdown",
  json: "System JSON",
};

const FORMAT_LANGUAGE: Record<CopyFormat, string> = {
  raw: "markdown",
  xml: "xml",
  markdown: "markdown",
  json: "json",
};

/**
 * Full-screen reader for one prompt: the complete text in a read-only editor, with variables
 * filled in live, so the user can read exactly what will be copied before copying it.
 */
const PromptReader: React.FC<PromptReaderProps> = ({
  prompt,
  folders,
  initialFormat,
  preferences,
  accentHex,
  onClose,
  onCopy,
  onEdit,
  onMove,
  onToggleFavorite,
}) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const folderSelectId = useId();
  const [format, setFormat] = useState<CopyFormat>(initialFormat);
  const [copied, setCopied] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(prompt.variables.map((v) => [v.name, v.defaultValue])),
  );

  useDialogFocus(dialogRef, true, onClose);

  const payload = useMemo(
    () => formatPromptPayload(prompt, format, values),
    [prompt, format, values],
  );
  const lineCount = payload.split("\n").length;
  const unfilled = prompt.variables.filter((v) => {
    const value = values[v.name] ?? "";
    return value.trim() === "" || value === `[${v.name}]`;
  });

  const handleCopy = async () => {
    const ok = await onCopy(prompt, values, format);
    if (ok) {
      setCopied(true);
    }
  };

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);

  // ⌘↵ / Ctrl+↵ copies from anywhere in the reader.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void handleCopy();
    }
  };

  const folderName = folders.find((f) => f.id === prompt.folderId)?.name ?? "Unfiled";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/55 backdrop-blur-xs"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className="w-full max-w-7xl h-[min(92vh,1100px)] m3-dialog flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-(--md-sys-color-outline-variant)">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Folder className="w-3.5 h-3.5" />
              <span>{folderName}</span>
              <span aria-hidden="true">·</span>
              <span>{prompt.category}</span>
              <span aria-hidden="true">·</span>
              <span>For {prompt.targetAgent}</span>
            </div>
            <h2
              id={titleId}
              className="mt-1 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 break-words"
            >
              {prompt.title}
            </h2>
            {prompt.description && (
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {prompt.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onToggleFavorite(prompt.id)}
              aria-pressed={prompt.isFavorite}
              aria-label={prompt.isFavorite ? "Unstar prompt" : "Star prompt"}
              className="p-2 rounded-full text-slate-500 hover:text-amber-400 hover:bg-(--md-sys-color-surface-container-high) cursor-pointer"
            >
              <Star
                filled={prompt.isFavorite}
                className={`w-4 h-4 ${prompt.isFavorite ? "text-amber-400" : ""}`}
              />
            </button>
            <button
              type="button"
              onClick={() => onEdit(prompt)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium border border-(--md-sys-color-outline-variant) text-slate-700 dark:text-slate-200 hover:bg-(--md-sys-color-surface-container-high) cursor-pointer"
            >
              <PencilSimple className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close reader"
              className="p-2 rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-(--md-sys-color-surface-container-high) cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          {/* Full prompt text */}
          <section aria-label="Prompt text" className="flex-1 min-w-0 min-h-0 flex flex-col">
            <div
              role="tablist"
              aria-label="Copy format"
              className="flex items-center gap-1 px-4 py-2 border-b border-(--md-sys-color-outline-variant)"
            >
              {(Object.keys(FORMAT_LABELS) as CopyFormat[]).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  role="tab"
                  aria-selected={format === fmt}
                  onClick={() => setFormat(fmt)}
                  className={`px-3 py-1.5 text-xs rounded-full cursor-pointer ${
                    format === fmt
                      ? "m3-tonal-pill font-semibold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  {FORMAT_LABELS[fmt]}
                </button>
              ))}
              <span className="ml-auto text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {lineCount} lines · {payload.length.toLocaleString()} chars · ~
                {estimateTokenCount(payload).toLocaleString()} tokens
              </span>
            </div>
            <div className="flex-1 min-h-[240px]">
              <Editor
                value={payload}
                language={FORMAT_LANGUAGE[format]}
                beforeMount={registerMaterial3MonacoThemes}
                theme={preferences.mode === "dark" ? "forgevault-m3-dark" : "forgevault-m3-light"}
                loading={
                  <pre className="h-full w-full overflow-auto p-4 font-mono text-xs whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                    {payload}
                  </pre>
                }
                options={{
                  readOnly: true,
                  domReadOnly: true,
                  wordWrap: "on",
                  minimap: { enabled: lineCount > 80 },
                  lineNumbers: "on",
                  fontSize: preferences.editorFontSize,
                  fontFamily: "'JetBrains Mono Variable', ui-monospace, Menlo, monospace",
                  scrollBeyondLastLine: false,
                  renderLineHighlight: "none",
                  padding: { top: 12, bottom: 12 },
                  automaticLayout: true,
                  ariaLabel: `Full text of ${prompt.title}`,
                }}
              />
            </div>
          </section>

          {/* Variables and actions */}
          <aside className="w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-(--md-sys-color-outline-variant) flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Variables
                </h3>
                {prompt.variables.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    This prompt has no {"{{variables}}"}. It is copied exactly as shown.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {prompt.variables.map((v) => {
                      const inputId = `${titleId}-var-${v.name}`;
                      return (
                        <div key={v.name}>
                          <label
                            htmlFor={inputId}
                            className="block text-xs font-mono font-medium text-slate-700 dark:text-slate-300"
                          >
                            {`{{${v.name}}}`}
                          </label>
                          {v.description && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {v.description}
                            </p>
                          )}
                          <textarea
                            id={inputId}
                            rows={2}
                            value={values[v.name] ?? ""}
                            onChange={(e) =>
                              setValues((prev) => ({ ...prev, [v.name]: e.target.value }))
                            }
                            className="mt-1 w-full px-3 py-2 text-xs font-mono rounded-lg bg-(--md-sys-color-surface-container-low) border border-(--md-sys-color-outline-variant) text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 resize-y"
                          />
                        </div>
                      );
                    })}
                    {unfilled.length > 0 && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-400">
                        Still using placeholders: {unfilled.map((v) => v.name).join(", ")}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor={folderSelectId}
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                >
                  Folder
                </label>
                <select
                  id={folderSelectId}
                  value={prompt.folderId ?? ""}
                  onChange={(e) => onMove(prompt.id, e.target.value || null)}
                  className="mt-2 w-full px-3 py-2 text-xs rounded-lg bg-(--md-sys-color-surface-container-low) border border-(--md-sys-color-outline-variant) text-slate-900 dark:text-slate-100"
                >
                  <option value="">Unfiled</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              {prompt.tags.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Tags
                  </h3>
                  <p className="mt-2 text-xs font-mono text-slate-600 dark:text-slate-300">
                    {prompt.tags.map((t) => `#${t}`).join(" ")}
                  </p>
                </div>
              )}

              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Copied {prompt.copyCount} {prompt.copyCount === 1 ? "time" : "times"} · updated{" "}
                {new Date(prompt.updatedAt).toLocaleString()}
              </p>
            </div>

            <div className="p-5 border-t border-(--md-sys-color-outline-variant)">
              <button
                type="button"
                onClick={() => void handleCopy()}
                style={{ backgroundColor: accentHex }}
                className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white shadow-xs hover:opacity-95 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? "Copied" : `Copy ${FORMAT_LABELS[format]}`}</span>
                <kbd className="font-mono text-[10px] opacity-80">⌘↵</kbd>
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default PromptReader;
