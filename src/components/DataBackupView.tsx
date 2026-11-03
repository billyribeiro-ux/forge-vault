import React, { useId, useMemo, useRef, useState } from "react";
import {
  ArrowCounterClockwise,
  BracketsCurly,
  Database,
  HardDrive,
  UploadSimple,
  Warning,
} from "./icons";
import {
  CodeLessonItem,
  MarkdownDocItem,
  PromptItem,
  TechStackItem,
  ThemePreferences,
} from "../types/vault";
import { createVaultBackupBundle } from "../services/vaultStorage";
import { ParsedBackup, describeBackupCounts, parseVaultBackup } from "../services/backupBundle";
import { describeSaveError, describeSaveResult, saveTextFile } from "../services/fileExport";

interface DataBackupViewProps {
  prompts: PromptItem[];
  stacks: TechStackItem[];
  lessons: CodeLessonItem[];
  markdownDocs: MarkdownDocItem[];
  preferences: ThemePreferences;
  onImportBundle: (backup: ParsedBackup) => void;
  onClearVault: () => void;
  onNotify: (message: string) => void;
}

interface PendingRestore {
  fileName: string;
  backup: ParsedBackup;
}

export function buildMarkdownHandbook(
  dateStamp: string,
  data: {
    prompts: PromptItem[];
    stacks: TechStackItem[];
    lessons: CodeLessonItem[];
    markdownDocs: MarkdownDocItem[];
  },
): string {
  const promptSection = data.prompts
    .map(
      (p) =>
        `## ${p.title}\n- Category: ${p.category} · Target Agent: ${p.targetAgent}\n\n\`\`\`text\n${p.content}\n\`\`\``,
    )
    .join("\n\n");

  const stackSection = data.stacks
    .map((s) => `## ${s.name}\n${s.tagline}\n\n\`\`\`xml\n${s.agentContextBlock}\n\`\`\``)
    .join("\n\n");

  const lessonSection = data.lessons
    .map(
      (l) =>
        `## ${l.title}\n\n${l.markdownNotes}\n\n${l.files
          .map((f) => `### File: \`${f.filename}\`\n\`\`\`${f.language}\n${f.content}\n\`\`\``)
          .join("\n\n")}`,
    )
    .join("\n\n---\n\n");

  const docSection = data.markdownDocs
    .map((d) => `## ${d.filename} — ${d.title}\n\n${d.content}`)
    .join("\n\n---\n\n");

  return `# ForgeVault Markdown Archive (${dateStamp})\n\n# Part 1: Prompt Library\n\n${promptSection}\n\n---\n\n# Part 2: Tech Stack Vault\n\n${stackSection}\n\n---\n\n# Part 3: Code Lessons\n\n${lessonSection}\n\n---\n\n# Part 4: Markdown Docs\n\n${docSection}\n`;
}

export const DataBackupView: React.FC<DataBackupViewProps> = ({
  prompts,
  stacks,
  lessons,
  markdownDocs,
  preferences,
  onImportBundle,
  onClearVault,
  onNotify,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"json" | "markdown" | null>(null);
  const importErrorId = useId();

  const bundleJsonString = useMemo(
    () =>
      JSON.stringify(
        createVaultBackupBundle({ prompts, stacks, lessons, markdownDocs, preferences }),
        null,
        2,
      ),
    [prompts, stacks, lessons, markdownDocs, preferences],
  );

  const kbSize = (new Blob([bundleJsonString]).size / 1024).toFixed(1);
  const totalMonacoFiles = lessons.reduce((acc, l) => acc + l.files.length, 0);
  const isEmpty =
    prompts.length === 0 &&
    stacks.length === 0 &&
    lessons.length === 0 &&
    markdownDocs.length === 0;

  const runExport = async (
    kind: "json" | "markdown",
    fileName: string,
    contents: string,
    mime: string,
  ) => {
    setBusy(kind);
    try {
      const result = await saveTextFile(fileName, contents, mime);
      onNotify(describeSaveResult(fileName, result));
    } catch (err) {
      onNotify(describeSaveError(fileName, err));
    } finally {
      setBusy(null);
    }
  };

  const handleExportJson = () => {
    const dateStamp = new Date().toISOString().slice(0, 10);
    void runExport(
      "json",
      `forgevault-workspace-${dateStamp}.json`,
      bundleJsonString,
      "application/json;charset=utf-8",
    );
  };

  const handleExportMarkdownArchive = () => {
    const dateStamp = new Date().toISOString().slice(0, 10);
    void runExport(
      "markdown",
      `forgevault-handbook-${dateStamp}.md`,
      buildMarkdownHandbook(dateStamp, { prompts, stacks, lessons, markdownDocs }),
      "text/markdown;charset=utf-8",
    );
  };

  const handleImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportError(null);
    let text: string;
    try {
      text = await file.text();
    } catch (err) {
      setImportError(
        `Could not read ${file.name}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }
    const parsed = parseVaultBackup(text);
    if (!parsed.ok) {
      setImportError(`${file.name} was not imported. ${parsed.error}.`);
      return;
    }
    setPendingRestore({ fileName: file.name, backup: parsed.backup });
  };

  const handleConfirmRestore = () => {
    if (!pendingRestore) return;
    onImportBundle(pendingRestore.backup);
    onNotify(
      `Restored ${describeBackupCounts(pendingRestore.backup)} from ${pendingRestore.fileName}`,
    );
    setPendingRestore(null);
  };

  const secondaryButton =
    "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium bg-(--md-sys-color-surface-container-high) text-slate-800 dark:text-slate-200 hover:bg-(--md-sys-color-surface-container-highest) transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait";

  return (
    <div className="space-y-6">
      <div className="pb-5 border-b border-(--md-sys-color-outline-variant)">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Backup & Data
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Your vault is stored only on this device. Export a JSON backup regularly, and use it to
          move your vault between the browser and the desktop app.
        </p>
      </div>

      {/* Storage metrics */}
      <dl className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          ["Prompts", prompts.length],
          ["Tech Stacks", stacks.length],
          ["Code Lessons", `${lessons.length} (${totalMonacoFiles} files)`],
          ["Markdown Docs", markdownDocs.length],
          ["Backup size", `${kbSize} KB`],
        ].map(([label, value]) => (
          <div key={label} className="p-4 m3-card">
            <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
            <dd className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {/* Backup & restore */}
      <section aria-labelledby="backup-heading" className="p-6 m3-card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
              <Database className="w-3.5 h-3.5 text-indigo-500" />
              <span>Stored locally in IndexedDB · no cloud sync</span>
            </div>
            <h2
              id="backup-heading"
              className="text-lg font-bold text-slate-900 dark:text-slate-100"
            >
              Export and restore
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              Restoring replaces the collections contained in the backup file. You can review what
              it contains before anything changes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(e) => void handleImportJsonFile(e)}
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-describedby={importError ? importErrorId : undefined}
              className={secondaryButton}
            >
              <UploadSimple className="w-3.5 h-3.5" />
              <span>Restore from JSON…</span>
            </button>

            <button
              type="button"
              onClick={handleExportMarkdownArchive}
              disabled={busy !== null || isEmpty}
              className={secondaryButton}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>{busy === "markdown" ? "Exporting…" : "Export as Markdown"}</span>
            </button>

            <button
              type="button"
              onClick={handleExportJson}
              disabled={busy !== null}
              style={{ backgroundColor: preferences.accentHex }}
              className="flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold text-white shadow-xs hover:opacity-95 transition-opacity cursor-pointer disabled:opacity-60 disabled:cursor-wait"
            >
              <BracketsCurly className="w-3.5 h-3.5" />
              <span>{busy === "json" ? "Exporting…" : "Export JSON backup"}</span>
            </button>
          </div>
        </div>

        {importError && (
          <p
            id={importErrorId}
            role="alert"
            className="mt-4 flex items-start gap-2 text-xs text-rose-600 dark:text-rose-400"
          >
            <Warning className="w-4 h-4 shrink-0" />
            <span>{importError}</span>
          </p>
        )}

        {pendingRestore && (
          <div
            role="alertdialog"
            aria-labelledby="restore-title"
            aria-describedby="restore-desc"
            className="mt-5 p-4 rounded-2xl border border-amber-500/50 bg-amber-500/10 space-y-3"
          >
            <h3
              id="restore-title"
              className="text-sm font-semibold text-slate-900 dark:text-slate-100"
            >
              Restore {pendingRestore.fileName}?
            </h3>
            <p id="restore-desc" className="text-xs text-slate-700 dark:text-slate-300">
              The backup contains {describeBackupCounts(pendingRestore.backup) || "no items"}
              {pendingRestore.backup.exportedAt
                ? `, exported ${new Date(pendingRestore.backup.exportedAt).toLocaleString()}`
                : ""}
              . These collections will replace what is in your vault now. Export a backup first if
              you may want the current data back.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setPendingRestore(null)}
                className="px-3.5 py-1.5 text-xs rounded-full border border-(--md-sys-color-outline-variant) text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExportJson}
                disabled={busy !== null}
                className="px-3.5 py-1.5 text-xs rounded-full border border-(--md-sys-color-outline-variant) text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                Export current vault first
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-full bg-amber-600 text-white cursor-pointer"
              >
                Replace and restore
              </button>
            </div>
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-(--md-sys-color-outline-variant) flex flex-wrap gap-3 items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Delete every prompt, stack, lesson, Markdown doc, and clipboard entry. Theme settings
            are kept.
          </span>
          {confirmReset ? (
            <div
              role="group"
              aria-label="Confirm clearing the vault"
              className="flex items-center gap-2"
            >
              <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                This cannot be undone.
              </span>
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmReset(false)}
                className="px-3.5 py-1 text-xs rounded-full border border-(--md-sys-color-outline-variant) text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onClearVault();
                  setConfirmReset(false);
                }}
                className="px-3.5 py-1 text-xs font-semibold rounded-full bg-rose-600 text-white cursor-pointer"
              >
                Delete all vault data
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              disabled={isEmpty}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-rose-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowCounterClockwise className="w-3.5 h-3.5" />
              <span>Clear all vault data…</span>
            </button>
          )}
        </div>
      </section>
    </div>
  );
};
