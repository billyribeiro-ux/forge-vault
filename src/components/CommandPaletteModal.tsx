import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, Check, Copy, FileText, MagnifyingGlass, Sparkle, Stack, X } from "./icons";
import {
  CodeLessonItem,
  MarkdownDocItem,
  PromptItem,
  TechStackItem,
  WorkspaceView,
} from "../types/vault";
import { formatPromptPayload } from "../services/vaultStorage";

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  prompts: PromptItem[];
  stacks: TechStackItem[];
  lessons: CodeLessonItem[];
  markdownDocs: MarkdownDocItem[];
  onNavigate: (view: WorkspaceView, itemId?: string) => void;
  onRecordClipboard?: (
    label: string,
    payload: string,
    kind: "prompt" | "stack" | "lesson" | "markdown",
  ) => void;
  onIncrementPromptCopy?: (id: string) => void;
  onIncrementStackCopy?: (id: string) => void;
  onNotify: (message: string) => void;
}

interface SearchResultItem {
  id: string;
  kind: "prompt" | "stack" | "lesson" | "markdown";
  title: string;
  subtitle: string;
  copyPayload: string;
  targetView: WorkspaceView;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  prompts,
  stacks,
  lessons,
  markdownDocs,
  onNavigate,
  onRecordClipboard,
  onIncrementPromptCopy,
  onIncrementStackCopy,
  onNotify,
}) => {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const results: SearchResultItem[] = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^#+/, "");

    const promptResults: SearchResultItem[] = prompts
      .filter(
        (p) =>
          !q ||
          p.title.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q) ||
          p.targetAgent.toLowerCase().includes(q) ||
          (p.tags || []).some((t) => t.toLowerCase().includes(q)),
      )
      .map((p) => {
        const tagStr = p.tags?.length ? ` · ${p.tags.map((t) => `#${t}`).join(" ")}` : "";
        return {
          id: p.id,
          kind: "prompt",
          title: p.title,
          subtitle: `Prompt · ${p.category} · ${p.targetAgent}${tagStr}`,
          copyPayload: formatPromptPayload(p, "raw"),
          targetView: "prompts",
        };
      });

    const stackResults: SearchResultItem[] = stacks
      .filter(
        (s) =>
          !q ||
          s.name.toLowerCase().includes(q) ||
          s.tagline.toLowerCase().includes(q) ||
          s.layer.toLowerCase().includes(q) ||
          (s.tags || []).some((t) => t.toLowerCase().includes(q)),
      )
      .map((s) => {
        const tagStr = s.tags?.length ? ` · ${s.tags.map((t) => `#${t}`).join(" ")}` : "";
        return {
          id: s.id,
          kind: "stack",
          title: s.name,
          subtitle: `Tech Stack · ${s.layer} · ${s.dependencies.length} packages${tagStr}`,
          copyPayload: s.agentContextBlock,
          targetView: "stacks",
        };
      });

    const lessonResults: SearchResultItem[] = lessons
      .filter(
        (l) =>
          !q ||
          l.title.toLowerCase().includes(q) ||
          l.topic.toLowerCase().includes(q) ||
          l.markdownNotes.toLowerCase().includes(q) ||
          (l.tags || []).some((t) => t.toLowerCase().includes(q)) ||
          l.files.some(
            (f) => f.filename.toLowerCase().includes(q) || f.content.toLowerCase().includes(q),
          ),
      )
      .map((l) => {
        const tagStr = l.tags?.length ? ` · ${l.tags.map((t) => `#${t}`).join(" ")}` : "";
        return {
          id: l.id,
          kind: "lesson",
          title: l.title,
          subtitle: `Code Lesson · ${l.topic} · ${l.files.length} Monaco files${tagStr}`,
          copyPayload: l.markdownNotes,
          targetView: "lessons",
        };
      });

    const docResults: SearchResultItem[] = markdownDocs
      .filter(
        (d) =>
          !q ||
          d.filename.toLowerCase().includes(q) ||
          d.title.toLowerCase().includes(q) ||
          d.content.toLowerCase().includes(q),
      )
      .map((d) => ({
        id: d.id,
        kind: "markdown",
        title: d.filename,
        subtitle: `Markdown Doc · ${d.category} · ${d.title}`,
        copyPayload: d.content,
        targetView: "markdown",
      }));

    return [...promptResults, ...stackResults, ...lessonResults, ...docResults].slice(0, 18);
  }, [query, prompts, stacks, lessons, markdownDocs]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) =>
          results.length > 0 ? (prev - 1 + results.length) % results.length : 0,
        );
      } else if (e.key === "Enter" && results[activeIndex]) {
        e.preventDefault();
        const item = results[activeIndex];
        if (e.shiftKey) {
          handleCopyItem(item);
        } else {
          onNavigate(item.targetView, item.id);
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, results, activeIndex]);

  const handleCopyItem = async (item: SearchResultItem) => {
    try {
      await navigator.clipboard.writeText(item.copyPayload);
      setCopiedId(item.id);
      if (item.kind === "prompt") {
        onIncrementPromptCopy?.(item.id);
      } else if (item.kind === "stack") {
        onIncrementStackCopy?.(item.id);
      }
      onRecordClipboard?.(item.title, item.copyPayload, item.kind);
      onNotify(`Copied "${item.title}" to clipboard`);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      onNotify("Clipboard copy failed");
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Global Command Palette"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/55 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl m3-dialog overflow-hidden"
      >
        {/* Material 3 Search Bar Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-(--md-sys-color-outline-variant) bg-(--md-sys-color-surface-container-low)">
          <MagnifyingGlass className="w-5 h-5 text-indigo-500 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search prompts, tech stacks, #tags, Monaco lessons, or .md files..."
            className="w-full text-sm bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {results.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No matching prompts, stacks, tags, or code lessons found for "{query}".
            </div>
          ) : (
            results.map((item, idx) => {
              const isSelected = idx === activeIndex;
              const isCopied = copiedId === item.id;

              return (
                <div
                  key={`${item.kind}-${item.id}`}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`flex items-center justify-between px-4 py-3 rounded-2xl transition-colors ${
                    isSelected
                      ? "m3-tonal-pill"
                      : "hover:bg-(--md-sys-color-surface-container-high)"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onNavigate(item.targetView, item.id);
                      onClose();
                    }}
                    className="flex items-center gap-3 text-left flex-1 min-w-0 cursor-pointer"
                  >
                    <div className="p-2.5 rounded-full bg-(--md-sys-color-surface-container-highest) text-slate-600 dark:text-slate-300 shrink-0">
                      {item.kind === "prompt" && <Sparkle className="w-4 h-4 text-indigo-500" />}
                      {item.kind === "stack" && <Stack className="w-4 h-4 text-emerald-500" />}
                      {item.kind === "lesson" && <BookOpen className="w-4 h-4 text-amber-500" />}
                      {item.kind === "markdown" && <FileText className="w-4 h-4 text-cyan-500" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {item.title}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate font-mono">
                        {item.subtitle}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <button
                      type="button"
                      onClick={() => handleCopyItem(item)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium bg-(--md-sys-color-surface) border border-(--md-sys-color-outline-variant) text-slate-700 dark:text-slate-200 hover:bg-(--md-sys-color-surface-container-high) cursor-pointer"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Keyboard Help Footer */}
        <div className="flex items-center justify-between px-5 py-3 bg-(--md-sys-color-surface-container-low) border-t border-(--md-sys-color-outline-variant) text-[11px] font-mono text-slate-500">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>·</span>
            <span>↵ Open in Studio</span>
            <span>·</span>
            <span>⇧↵ Instant Copy</span>
          </div>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
};
