import React, { useMemo, useRef, useState } from "react";
import "../services/monacoSetup";
import Editor from "@monaco-editor/react";
import {
  Check,
  Code,
  Columns,
  Copy,
  DownloadSimple,
  Eye,
  FileText,
  Plus,
  Trash,
  UploadSimple,
} from "./icons";
import { MarkdownDocItem, ThemePreferences } from "../types/vault";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { estimateTokenCount } from "../services/vaultStorage";
import { describeSaveError, describeSaveResult, saveTextFile } from "../services/fileExport";
import { newId } from "../services/ids";
import { registerMaterial3MonacoThemes } from "../services/monacoTheme";

interface MarkdownVaultViewProps {
  docs: MarkdownDocItem[];
  preferences: ThemePreferences;
  onSaveDoc: (doc: MarkdownDocItem) => void;
  onDeleteDoc: (id: string) => void;
  onRecordClipboard?: (label: string, payload: string, kind: "markdown") => void;
  onNotify: (message: string) => void;
}

export const MarkdownVaultView: React.FC<MarkdownVaultViewProps> = ({
  docs,
  preferences,
  onSaveDoc,
  onDeleteDoc,
  onRecordClipboard,
  onNotify,
}) => {
  const [selectedDocId, setSelectedDocId] = useState<string>(docs[0]?.id || "");
  const [viewMode, setViewMode] = useState<"split" | "editor" | "reader">("split");
  const [copiedDoc, setCopiedDoc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeDoc = useMemo(
    () => docs.find((d) => d.id === selectedDocId) || docs[0],
    [docs, selectedDocId],
  );

  const handleCreateNewDoc = () => {
    const newDoc: MarkdownDocItem = {
      id: newId("md"),
      filename: `NOTES_${new Date().toISOString().slice(0, 10)}.md`,
      title: "Untitled Markdown Document",
      category: "Scratchpad",
      isFavorite: false,
      updatedAt: new Date().toISOString(),
      content: `# Untitled Markdown Document\n\n`,
    };
    onSaveDoc(newDoc);
    setSelectedDocId(newDoc.id);
    onNotify(`Created ${newDoc.filename}`);
  };

  const handleAppendMarkdownSnippet = (snippet: string) => {
    if (!activeDoc) return;
    onSaveDoc({
      ...activeDoc,
      content: `${activeDoc.content.trim()}\n\n${snippet}\n`,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleImportMdFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : "";
      const headingMatch = /^#\s+(.+)$/m.exec(content);
      const importedDoc: MarkdownDocItem = {
        id: newId("md"),
        filename: file.name.endsWith(".md") ? file.name : `${file.name}.md`,
        title: headingMatch ? headingMatch[1].trim() : file.name.replace(/\.md$/i, ""),
        category: "Architecture Note",
        content,
        isFavorite: false,
        updatedAt: new Date().toISOString(),
      };
      onSaveDoc(importedDoc);
      setSelectedDocId(importedDoc.id);
      onNotify(`Imported "${importedDoc.filename}" into Markdown Vault`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleCopyDoc = async () => {
    if (!activeDoc) return;
    try {
      await navigator.clipboard.writeText(activeDoc.content);
      setCopiedDoc(true);
      onRecordClipboard?.(activeDoc.filename, activeDoc.content, "markdown");
      onNotify(`Copied ${activeDoc.filename} to clipboard`);
      setTimeout(() => setCopiedDoc(false), 1800);
    } catch {
      onNotify("Failed to copy Markdown");
    }
  };

  if (!activeDoc) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-(--md-sys-color-outline-variant)">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Markdown (.md) Vault & Live Editor
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Author standalone <code className="font-mono">AGENTS.md</code> files, cheat sheets,
              and technical docs with side-by-side Monaco Markdown editing and live preview.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.markdown,.txt"
              onChange={handleImportMdFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium bg-(--md-sys-color-surface-container-low) border border-(--md-sys-color-outline-variant) text-slate-700 dark:text-slate-200 hover:bg-(--md-sys-color-surface-container-high) transition-colors cursor-pointer"
            >
              <UploadSimple className="w-3.5 h-3.5" />
              <span>Import .md</span>
            </button>
            <button
              type="button"
              onClick={handleCreateNewDoc}
              style={{ backgroundColor: preferences.accentHex }}
              className="flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-semibold text-white shadow-xs hover:opacity-95 transition-opacity cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New .md File</span>
            </button>
          </div>
        </div>

        <div className="p-12 text-center m3-card">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            No Markdown documents yet
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Create a new <code className="font-mono">.md</code> file or import an existing Markdown
            document from disk to open the split-pane Monaco Markdown editor and live preview.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-full border border-(--md-sys-color-outline-variant) text-slate-700 dark:text-slate-300 hover:bg-(--md-sys-color-surface-container-high) cursor-pointer"
            >
              <UploadSimple className="w-3.5 h-3.5" />
              <span>Import .md File</span>
            </button>
            <button
              type="button"
              onClick={handleCreateNewDoc}
              style={{ backgroundColor: preferences.accentHex }}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-full text-white shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First .md File</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const wordCount = activeDoc.content.trim().split(/\s+/).filter(Boolean).length;
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-(--md-sys-color-outline-variant)">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Markdown (.md) Vault & Live Editor
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Author standalone <code className="font-mono">AGENTS.md</code> files, cheat sheets, and
            technical docs with side-by-side Monaco Markdown editing and live preview.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-full bg-(--md-sys-color-surface-container-low) border border-(--md-sys-color-outline-variant)">
            <button
              type="button"
              onClick={() => setViewMode("split")}
              className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full cursor-pointer transition-all ${
                viewMode === "split"
                  ? "m3-tonal-pill font-semibold shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Split</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("editor")}
              className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full cursor-pointer transition-all ${
                viewMode === "editor"
                  ? "m3-tonal-pill font-semibold shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>Monaco Only</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("reader")}
              className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full cursor-pointer transition-all ${
                viewMode === "reader"
                  ? "m3-tonal-pill font-semibold shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Reader</span>
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.markdown,.txt"
            onChange={handleImportMdFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium bg-(--md-sys-color-surface-container-low) border border-(--md-sys-color-outline-variant) text-slate-700 dark:text-slate-200 hover:bg-(--md-sys-color-surface-container-high) transition-colors cursor-pointer"
          >
            <UploadSimple className="w-3.5 h-3.5" />
            <span>Import .md</span>
          </button>

          <button
            type="button"
            onClick={() => {
              saveTextFile(activeDoc.filename, activeDoc.content)
                .then((result) => onNotify(describeSaveResult(activeDoc.filename, result)))
                .catch((err: unknown) => onNotify(describeSaveError(activeDoc.filename, err)));
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium bg-(--md-sys-color-surface-container-low) border border-(--md-sys-color-outline-variant) text-slate-700 dark:text-slate-200 hover:bg-(--md-sys-color-surface-container-high) transition-colors cursor-pointer"
          >
            <DownloadSimple className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>

          <button
            type="button"
            onClick={handleCreateNewDoc}
            style={{ backgroundColor: preferences.accentHex }}
            className="flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-semibold text-white shadow-xs hover:opacity-95 transition-opacity cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New .md File</span>
          </button>
        </div>
      </div>

      {/* Document Tabs & Metadata Editor */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {docs.map((doc) => {
            const isSelected = doc.id === activeDoc.id;
            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => setSelectedDocId(doc.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-mono transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isSelected
                    ? "m3-tonal-pill font-semibold shadow-2xs"
                    : "bg-(--md-sys-color-surface-container-low) border border-(--md-sys-color-outline-variant) text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{doc.filename}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={activeDoc.filename}
            onChange={(e) =>
              onSaveDoc({
                ...activeDoc,
                filename: e.target.value,
                updatedAt: new Date().toISOString(),
              })
            }
            aria-label="Markdown filename"
            className="px-3.5 py-1.5 text-xs font-mono rounded-full bg-(--md-sys-color-surface-container-low) border border-(--md-sys-color-outline-variant) text-slate-900 dark:text-slate-100 w-52"
          />

          <select
            value={activeDoc.category}
            onChange={(e) =>
              onSaveDoc({
                ...activeDoc,
                category: e.target.value as MarkdownDocItem["category"],
                updatedAt: new Date().toISOString(),
              })
            }
            className="px-3.5 py-1.5 text-xs rounded-full bg-(--md-sys-color-surface-container-low) border border-(--md-sys-color-outline-variant) text-slate-700 dark:text-slate-300"
          >
            <option value="Agent Rules">Agent Rules</option>
            <option value="Architecture Note">Architecture Note</option>
            <option value="Cheat Sheet">Cheat Sheet</option>
            <option value="Scratchpad">Scratchpad</option>
          </select>

          <button
            type="button"
            onClick={handleCopyDoc}
            style={copiedDoc ? undefined : { backgroundColor: preferences.accentHex }}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold text-white transition-all cursor-pointer ${
              copiedDoc ? "bg-emerald-600" : "hover:opacity-95"
            }`}
          >
            {copiedDoc ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied .md</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy .md</span>
              </>
            )}
          </button>

          {docs.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const remaining = docs.filter((d) => d.id !== activeDoc.id);
                onDeleteDoc(activeDoc.id);
                setSelectedDocId(remaining[0]?.id || "");
                onNotify(`Deleted ${activeDoc.filename}`);
              }}
              className="p-2 rounded-full text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              title="Delete Document"
            >
              <Trash className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Side-by-Side Monaco Markdown Source & Rendered Preview */}
      <div
        className={`grid gap-5 ${
          viewMode === "split" ? "grid-cols-1 lg:grid-cols-12" : "grid-cols-1"
        }`}
      >
        {/* Monaco Markdown Source Editor */}
        {(viewMode === "split" || viewMode === "editor") && (
          <div
            className={`${
              viewMode === "split" ? "lg:col-span-6" : "col-span-1"
            } flex flex-col m3-card overflow-hidden h-[660px]`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-(--md-sys-color-surface-container) border-b border-(--md-sys-color-outline-variant) text-xs">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    handleAppendMarkdownSnippet("## New Section Heading\n\n Key details here.")
                  }
                  className="px-2.5 py-0.5 rounded-full bg-(--md-sys-color-surface-container-high) border border-(--md-sys-color-outline-variant) text-slate-700 dark:text-slate-300 font-mono text-[11px] cursor-pointer"
                >
                  + H2
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleAppendMarkdownSnippet(
                      "```typescript\nexport function example(): void {}\n```",
                    )
                  }
                  className="px-2.5 py-0.5 rounded-full bg-(--md-sys-color-surface-container-high) border border-(--md-sys-color-outline-variant) text-slate-700 dark:text-slate-300 font-mono text-[11px] cursor-pointer"
                >
                  + Code Block
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleAppendMarkdownSnippet(
                      "| Layer | Package | Role |\n| :--- | :--- | :--- |\n| UI | React 19 | Concurrent Components |",
                    )
                  }
                  className="px-2.5 py-0.5 rounded-full bg-(--md-sys-color-surface-container-high) border border-(--md-sys-color-outline-variant) text-slate-700 dark:text-slate-300 font-mono text-[11px] cursor-pointer"
                >
                  + Table
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleAppendMarkdownSnippet(
                      "```xml\n<agent_instructions>\n  <rule>Preserve strict TypeScript types</rule>\n</agent_instructions>\n```",
                    )
                  }
                  className="px-2.5 py-0.5 rounded-full bg-(--md-sys-color-surface-container-high) border border-(--md-sys-color-outline-variant) text-indigo-600 dark:text-indigo-400 font-mono text-[11px] cursor-pointer"
                >
                  + &lt;agent_xml&gt;
                </button>
              </div>

              <span className="font-mono text-slate-500 tabular-nums">
                {wordCount} words · {readingMinutes} min read ·{" "}
                {estimateTokenCount(activeDoc.content)} tokens
              </span>
            </div>
            <div className="flex-1">
              <Editor
                height="100%"
                path={`md-vault/${activeDoc.id}.md`}
                language="markdown"
                value={activeDoc.content}
                beforeMount={registerMaterial3MonacoThemes}
                theme={preferences.mode === "dark" ? "forgevault-m3-dark" : "forgevault-m3-light"}
                onChange={(val) =>
                  onSaveDoc({
                    ...activeDoc,
                    content: val ?? "",
                    updatedAt: new Date().toISOString(),
                  })
                }
                options={{
                  fontSize: preferences.editorFontSize,
                  fontFamily: "'JetBrains Mono Variable', ui-monospace, Menlo, monospace",
                  wordWrap: "on",
                  minimap: { enabled: false },
                  lineNumbers: preferences.editorLineNumbers ? "on" : "off",
                  scrollBeyondLastLine: false,
                  padding: { top: 16, bottom: 16 },
                }}
              />
            </div>
          </div>
        )}

        {/* Live Rendered Markdown Preview */}
        {(viewMode === "split" || viewMode === "reader") && (
          <div
            className={`${
              viewMode === "split" ? "lg:col-span-6" : "col-span-1"
            } flex flex-col m3-card overflow-hidden h-[660px]`}
          >
            <div className="flex items-center justify-between px-4 py-2.5 bg-(--md-sys-color-surface-container) border-b border-(--md-sys-color-outline-variant) text-xs text-slate-500">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Live Formatted Preview
              </span>
              <span>
                {activeDoc.category} · {activeDoc.filename}
              </span>
            </div>
            <div className="flex-1 p-6 overflow-y-auto">
              <MarkdownRenderer content={activeDoc.content} onCopySuccess={onNotify} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
