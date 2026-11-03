import React, { useMemo, useState } from "react";
import Editor, { DiffEditor } from "@monaco-editor/react";
import {
  ArrowLineLeft,
  BookOpen,
  Check,
  Code,
  Columns,
  Copy,
  DownloadSimple,
  Eye,
  FileCode,
  FilePlus,
  GitDiff,
  PencilSimple,
  Play,
  Plus,
  Star,
  Tag,
  TerminalWindow,
  Trash,
  X,
} from "./icons";
import { CodeLessonItem, LessonFile, MonacoLanguage, ThemePreferences } from "../types/vault";
import { MarkdownRenderer, extractMarkdownHeadings } from "./MarkdownRenderer";
import { downloadTextFile, estimateTokenCount, normalizeTagLabel } from "../services/vaultStorage";
import { registerMaterial3MonacoThemes } from "../services/monacoTheme";
import { SandboxExecutionResult, executeInSandboxWorker } from "../services/sandboxRunner";

interface LessonsSplitStudioProps {
  lessons: CodeLessonItem[];
  activeLessonId: string;
  preferences: ThemePreferences;
  onSelectLesson: (id: string) => void;
  onSaveLesson: (lesson: CodeLessonItem) => void;
  onDeleteLesson: (id: string) => void;
  onUpdatePreferences: (partial: Partial<ThemePreferences>) => void;
  onRecordClipboard?: (label: string, payload: string, kind: "lesson") => void;
  onNotify: (message: string) => void;
}

const LANGUAGES: MonacoLanguage[] = [
  "typescript",
  "javascript",
  "rust",
  "json",
  "markdown",
  "css",
  "html",
  "sql",
  "python",
  "shell",
];

function inferLanguageFromFilename(filename: string): MonacoLanguage {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) return "typescript";
  if (lower.endsWith(".js") || lower.endsWith(".jsx")) return "javascript";
  if (lower.endsWith(".rs")) return "rust";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".md")) return "markdown";
  if (lower.endsWith(".css")) return "css";
  if (lower.endsWith(".html")) return "html";
  if (lower.endsWith(".sql")) return "sql";
  if (lower.endsWith(".py")) return "python";
  if (lower.endsWith(".sh") || lower.endsWith(".zsh")) return "shell";
  return "typescript";
}

export const LessonsSplitStudio: React.FC<LessonsSplitStudioProps> = ({
  lessons,
  activeLessonId,
  preferences,
  onSelectLesson,
  onSaveLesson,
  onDeleteLesson,
  onUpdatePreferences,
  onRecordClipboard,
  onNotify,
}) => {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isAddingLessonTag, setIsAddingLessonTag] = useState(false);
  const [inlineLessonTagValue, setInlineLessonTagValue] = useState("");

  const [layoutMode, setLayoutMode] = useState<"split" | "markdown-only" | "code-only">("split");
  const [markdownEditMode, setMarkdownEditMode] = useState<"preview" | "source">("preview");
  const [isDiffMode, setIsDiffMode] = useState(false);
  const [compareFileId, setCompareFileId] = useState<string>("");
  const [sandboxOutput, setSandboxOutput] = useState<SandboxExecutionResult | null>(null);
  const [isRunningSandbox, setIsRunningSandbox] = useState(false);

  const [isAddingFile, setIsAddingFile] = useState(false);
  const [newFilename, setNewFilename] = useState("");
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameFileValue, setRenameFileValue] = useState("");

  const [copiedAction, setCopiedAction] = useState<string | null>(null);
  const [isCreatingLesson, setIsCreatingLesson] = useState(false);
  const [isEditingLessonMeta, setIsEditingLessonMeta] = useState(false);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [newLessonTopic, setNewLessonTopic] = useState("");
  const [newLessonTagsInput, setNewLessonTagsInput] = useState("");
  const [newLessonDifficulty, setNewLessonDifficulty] = useState<
    "Foundational" | "Intermediate" | "Advanced"
  >("Intermediate");

  // Compute all unique tags across Lessons
  const allLessonTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of lessons) {
      for (const t of l.tags || []) {
        counts.set(t, (counts.get(t) || 0) + 1);
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [lessons]);

  const filteredLessons = useMemo(() => {
    if (selectedTags.length === 0) return lessons;
    return lessons.filter((l) => {
      const lTags = l.tags || [];
      return selectedTags.every((t) => lTags.includes(t));
    });
  }, [lessons, selectedTags]);

  const activeLesson = useMemo(() => {
    const inFiltered = filteredLessons.find((l) => l.id === activeLessonId);
    if (inFiltered) return inFiltered;
    return filteredLessons[0] || lessons.find((l) => l.id === activeLessonId) || lessons[0];
  }, [filteredLessons, lessons, activeLessonId]);

  const toggleLessonTagFilter = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const headings = useMemo(
    () => (activeLesson ? extractMarkdownHeadings(activeLesson.markdownNotes) : []),
    [activeLesson],
  );

  const handleCreateNewLesson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLessonTitle.trim()) return;
    const initialFileId = `file-${Date.now()}`;
    const parsedTags = newLessonTagsInput.split(",").map(normalizeTagLabel).filter(Boolean);

    const newLesson: CodeLessonItem = {
      id: `lesson-${Date.now()}`,
      title: newLessonTitle.trim(),
      topic: newLessonTopic.trim() || "General",
      difficulty: newLessonDifficulty,
      tags: parsedTags,
      summary: "",
      markdownNotes: `# ${newLessonTitle.trim()}\n\n`,
      files: [
        {
          id: initialFileId,
          filename: "index.ts",
          language: "typescript",
          content: "",
        },
      ],
      activeFileId: initialFileId,
      isFavorite: false,
      updatedAt: new Date().toISOString(),
    };
    onSaveLesson(newLesson);
    onSelectLesson(newLesson.id);
    setNewLessonTitle("");
    setNewLessonTopic("");
    setNewLessonTagsInput("");
    setIsCreatingLesson(false);
    onNotify(`Created lesson "${newLesson.title}"`);
  };

  if (!activeLesson) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-(--md-sys-color-outline-variant)">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Code Lessons (Monaco Split Studio)
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Side-by-side Markdown lesson notes, multi-file Monaco IDE buffers, Diff comparison,
              and live TypeScript/JavaScript sandbox execution.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsCreatingLesson(true)}
            style={{ backgroundColor: preferences.accentHex }}
            className="flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold text-white shadow-xs hover:opacity-95 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Lesson</span>
          </button>
        </div>

        <div className="p-12 text-center m3-card">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            No code lessons yet
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Create your first code lesson to launch the split-pane Markdown guide and multi-tab
            Monaco Editor workspace.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setIsCreatingLesson(true)}
              style={{ backgroundColor: preferences.accentHex }}
              className="px-5 py-2 text-xs font-semibold rounded-full text-white shadow-xs cursor-pointer"
            >
              Create First Code Lesson
            </button>
          </div>
        </div>

        {isCreatingLesson && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs">
            <div className="w-full max-w-md m3-dialog overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Create New Code Lesson
                </h2>
                <button
                  type="button"
                  onClick={() => setIsCreatingLesson(false)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleCreateNewLesson} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Lesson Title
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={newLessonTitle}
                    onChange={(e) => setNewLessonTitle(e.target.value)}
                    placeholder="e.g. Custom State Machine in TypeScript"
                    className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Topic Area
                  </label>
                  <input
                    type="text"
                    value={newLessonTopic}
                    onChange={(e) => setNewLessonTopic(e.target.value)}
                    placeholder="e.g. Systems & Architecture"
                    className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Custom Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={newLessonTagsInput}
                    onChange={(e) => setNewLessonTagsInput(e.target.value)}
                    placeholder="e.g. typescript, monaco, patterns"
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Difficulty Level
                  </label>
                  <select
                    value={newLessonDifficulty}
                    onChange={(e) =>
                      setNewLessonDifficulty(
                        e.target.value as "Foundational" | "Intermediate" | "Advanced",
                      )
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="Foundational">Foundational</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingLesson(false)}
                    className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{ backgroundColor: preferences.accentHex }}
                    className="px-4 py-2 text-xs font-semibold rounded-lg text-white cursor-pointer"
                  >
                    Create Lesson Studio
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  const activeFile =
    activeLesson.files.find((f) => f.id === activeLesson.activeFileId) || activeLesson.files[0];

  const secondaryDiffFile =
    activeLesson.files.find((f) => f.id === compareFileId) ||
    activeLesson.files.find((f) => f.id !== activeFile?.id) ||
    activeFile;

  const handleAddInlineLessonTag = () => {
    const clean = normalizeTagLabel(inlineLessonTagValue);
    if (!clean) {
      setIsAddingLessonTag(false);
      return;
    }
    const existing = activeLesson.tags || [];
    if (!existing.includes(clean)) {
      onSaveLesson({
        ...activeLesson,
        tags: [...existing, clean],
        updatedAt: new Date().toISOString(),
      });
      onNotify(`Added tag #${clean} to lesson`);
    }
    setInlineLessonTagValue("");
    setIsAddingLessonTag(false);
  };

  const handleRemoveLessonTag = (tagToRemove: string) => {
    onSaveLesson({
      ...activeLesson,
      tags: (activeLesson.tags || []).filter((t) => t !== tagToRemove),
      updatedAt: new Date().toISOString(),
    });
    onNotify(`Removed tag #${tagToRemove}`);
  };

  const handleSelectFileTab = (fileId: string) => {
    onSaveLesson({
      ...activeLesson,
      activeFileId: fileId,
    });
  };

  const handleCodeChange = (nextValue: string | undefined) => {
    if (!activeFile) return;
    const updatedFiles = activeLesson.files.map((f) =>
      f.id === activeFile.id ? { ...f, content: nextValue ?? "" } : f,
    );
    onSaveLesson({
      ...activeLesson,
      files: updatedFiles,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleMarkdownNotesChange = (nextMarkdown: string | undefined) => {
    onSaveLesson({
      ...activeLesson,
      markdownNotes: nextMarkdown ?? "",
      updatedAt: new Date().toISOString(),
    });
  };

  const handleEmbedActiveFileIntoMarkdown = () => {
    if (!activeFile) return;
    const snippetBlock = `\n\n### Snippet from \`${activeFile.filename}\`\n\`\`\`${activeFile.language}\n${activeFile.content.trim()}\n\`\`\`\n`;
    onSaveLesson({
      ...activeLesson,
      markdownNotes: `${activeLesson.markdownNotes.trim()}${snippetBlock}`,
      updatedAt: new Date().toISOString(),
    });
    onNotify(`Embedded ${activeFile.filename} into LESSON_GUIDE.md`);
  };

  const handleRunActiveFileInSandbox = async () => {
    if (!activeFile || isRunningSandbox) return;
    if (activeFile.language !== "typescript" && activeFile.language !== "javascript") {
      return;
    }

    setIsRunningSandbox(true);
    try {
      const res = await executeInSandboxWorker(activeFile.content, activeFile.language, 3000);
      setSandboxOutput(res);
      if (res.error) {
        onNotify(`Sandbox error in ${activeFile.filename}`);
      } else {
        onNotify(`Executed ${activeFile.filename} in ${res.durationMs}ms`);
      }
    } finally {
      setIsRunningSandbox(false);
    }
  };

  const handleOpenEditLessonMeta = () => {
    setNewLessonTitle(activeLesson.title);
    setNewLessonTopic(activeLesson.topic);
    setNewLessonDifficulty(activeLesson.difficulty);
    setNewLessonTagsInput((activeLesson.tags || []).join(", "));
    setIsEditingLessonMeta(true);
  };

  const handleSaveEditedLessonMeta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLessonTitle.trim()) return;
    const parsedTags = newLessonTagsInput.split(",").map(normalizeTagLabel).filter(Boolean);

    onSaveLesson({
      ...activeLesson,
      title: newLessonTitle.trim(),
      topic: newLessonTopic.trim() || "General",
      difficulty: newLessonDifficulty,
      tags: parsedTags,
      updatedAt: new Date().toISOString(),
    });
    setIsEditingLessonMeta(false);
    onNotify(`Updated lesson "${newLessonTitle.trim()}"`);
  };

  const handleCommitRenameFile = (fileId: string) => {
    const clean = renameFileValue.trim();
    setRenamingFileId(null);
    if (!clean) return;
    const detectedLang = inferLanguageFromFilename(clean);
    const updatedFiles = activeLesson.files.map((f) =>
      f.id === fileId ? { ...f, filename: clean, language: detectedLang } : f,
    );
    onSaveLesson({
      ...activeLesson,
      files: updatedFiles,
      updatedAt: new Date().toISOString(),
    });
    onNotify(`Renamed file tab to "${clean}"`);
  };

  const handleAddNewFile = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newFilename.trim();
    if (!cleanName) return;

    const detectedLang = inferLanguageFromFilename(cleanName);
    const createdFile: LessonFile = {
      id: `file-${Date.now()}`,
      filename: cleanName,
      language: detectedLang,
      content: `// ${cleanName}\n\n`,
    };

    onSaveLesson({
      ...activeLesson,
      files: [...activeLesson.files, createdFile],
      activeFileId: createdFile.id,
      updatedAt: new Date().toISOString(),
    });
    setNewFilename("");
    setIsAddingFile(false);
    onNotify(`Added file tab "${cleanName}"`);
  };

  const handleDeleteActiveFile = (fileId: string) => {
    if (activeLesson.files.length <= 1) {
      onNotify("A code lesson must keep at least one code file tab.");
      return;
    }
    const remaining = activeLesson.files.filter((f) => f.id !== fileId);
    onSaveLesson({
      ...activeLesson,
      files: remaining,
      activeFileId: remaining[0].id,
      updatedAt: new Date().toISOString(),
    });
    onNotify("Removed file tab from lesson");
  };

  const handleLanguageChange = (lang: MonacoLanguage) => {
    if (!activeFile) return;
    const updatedFiles = activeLesson.files.map((f) =>
      f.id === activeFile.id ? { ...f, language: lang } : f,
    );
    onSaveLesson({
      ...activeLesson,
      files: updatedFiles,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleCopyActiveFile = async () => {
    if (!activeFile) return;
    try {
      await navigator.clipboard.writeText(activeFile.content);
      setCopiedAction("file");
      onRecordClipboard?.(
        `${activeLesson.title} — ${activeFile.filename}`,
        activeFile.content,
        "lesson",
      );
      onNotify(`Copied ${activeFile.filename} to clipboard`);
      setTimeout(() => setCopiedAction(null), 1800);
    } catch {
      onNotify("Failed to copy file");
    }
  };

  const handleCopyFullLessonForAgent = async () => {
    const filesFormatted = activeLesson.files
      .map(
        (f) =>
          `### File: ${f.filename} (${f.language})\n\`\`\`${f.language}\n${f.content.trim()}\n\`\`\``,
      )
      .join("\n\n");

    const tagsAttr = activeLesson.tags?.length ? ` tags="${activeLesson.tags.join(",")}"` : "";

    const bundle = `<code_lesson title="${activeLesson.title}" topic="${activeLesson.topic}" difficulty="${activeLesson.difficulty}"${tagsAttr}>\n## Lesson Guide (.md)\n${activeLesson.markdownNotes.trim()}\n\n## Multi-File Monaco Source Tabs\n${filesFormatted}\n</code_lesson>`;

    try {
      await navigator.clipboard.writeText(bundle);
      setCopiedAction("bundle");
      onRecordClipboard?.(`${activeLesson.title} (Full Lesson Bundle)`, bundle, "lesson");
      onNotify(`Copied entire lesson + ${activeLesson.files.length} files for Argon`);
      setTimeout(() => setCopiedAction(null), 1800);
    } catch {
      onNotify("Failed to copy lesson bundle");
    }
  };

  const handleDownloadLessonMarkdown = () => {
    const filesAppendix = activeLesson.files
      .map(
        (f) =>
          `\n\n## Source File: \`${f.filename}\`\n\`\`\`${f.language}\n${f.content.trim()}\n\`\`\``,
      )
      .join("");

    const fullMd = `${activeLesson.markdownNotes.trim()}\n\n---\n# Attached Monaco Code Files${filesAppendix}\n`;
    const safeSlug = activeLesson.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    downloadTextFile(`${safeSlug || "lesson"}.md`, fullMd);
    onNotify(`Downloaded ${safeSlug}.md`);
  };

  const leftColSpan =
    preferences.lessonSplitRatio === "35-65"
      ? "lg:col-span-4"
      : preferences.lessonSplitRatio === "60-40"
        ? "lg:col-span-7"
        : "lg:col-span-5";

  const rightColSpan =
    preferences.lessonSplitRatio === "35-65"
      ? "lg:col-span-8"
      : preferences.lessonSplitRatio === "60-40"
        ? "lg:col-span-5"
        : "lg:col-span-7";

  const canRunInSandbox =
    activeFile && (activeFile.language === "typescript" || activeFile.language === "javascript");

  return (
    <div className="space-y-4">
      {/* Top Lesson Studio Bar */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 pb-4 border-b border-(--md-sys-color-outline-variant)">
        {/* Lesson Selector, Metadata & Inline Tags */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={activeLesson.id}
              onChange={(e) => {
                onSelectLesson(e.target.value);
                setSandboxOutput(null);
              }}
              aria-label="Select active code lesson"
              className="px-4 py-2 text-sm font-semibold rounded-full bg-(--md-sys-color-surface-container-low) border border-(--md-sys-color-outline-variant) text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              {filteredLessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.title}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {activeLesson.topic}
              </span>
              <span aria-hidden="true">·</span>
              <span>{activeLesson.difficulty}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {activeLesson.files.length} Monaco files
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                onSaveLesson({ ...activeLesson, isFavorite: !activeLesson.isFavorite })
              }
              className="p-2 rounded-full text-slate-400 hover:text-amber-400 hover:bg-(--md-sys-color-surface-container-high) transition-colors cursor-pointer"
              title="Star Lesson"
            >
              <Star
                filled={activeLesson.isFavorite}
                className={`w-4 h-4 ${activeLesson.isFavorite ? "text-amber-400" : ""}`}
              />
            </button>

            <button
              type="button"
              onClick={handleOpenEditLessonMeta}
              className="p-2 rounded-full text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-(--md-sys-color-surface-container-high) transition-colors cursor-pointer"
              title="Edit Lesson Title, Topic, Difficulty & Tags"
            >
              <PencilSimple className="w-4 h-4" />
            </button>
          </div>

          {/* Active Lesson Tags + Inline Tag Adder */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-slate-400 font-medium">Lesson Tags:</span>
            {(activeLesson.tags || []).map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <span
                  key={tag}
                  className="group inline-flex items-center gap-1 font-mono text-slate-500 dark:text-slate-400"
                >
                  <button
                    type="button"
                    onClick={() => toggleLessonTagFilter(tag)}
                    className={`hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer ${
                      isSelected
                        ? "text-indigo-600 dark:text-indigo-400 font-semibold underline underline-offset-4"
                        : ""
                    }`}
                  >
                    #{tag}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveLessonTag(tag)}
                    title={`Remove #${tag}`}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition-opacity cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}

            {isAddingLessonTag ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddInlineLessonTag();
                }}
                className="inline-flex items-center gap-1"
              >
                <input
                  type="text"
                  autoFocus
                  value={inlineLessonTagValue}
                  onChange={(e) => setInlineLessonTagValue(e.target.value)}
                  onBlur={handleAddInlineLessonTag}
                  placeholder="new-tag"
                  className="w-24 px-2 py-0.5 text-xs font-mono rounded-full bg-(--md-sys-color-surface-container-high) border border-indigo-500 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsAddingLessonTag(true);
                  setInlineLessonTagValue("");
                }}
                className="text-[11px] font-mono text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                + tag
              </button>
            )}
          </div>
        </div>

        {/* Right Controls: Split Mode Switcher + Ratio + Export / Copy Bundle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Split View Selector */}
          <div className="flex items-center gap-1 p-1 rounded-full bg-(--md-sys-color-surface-container-low) border border-(--md-sys-color-outline-variant)">
            <button
              type="button"
              onClick={() => setLayoutMode("split")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                layoutMode === "split"
                  ? "m3-tonal-pill font-semibold shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Split Studio</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode("markdown-only")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                layoutMode === "markdown-only"
                  ? "m3-tonal-pill font-semibold shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Markdown (.md)</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode("code-only")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                layoutMode === "code-only"
                  ? "m3-tonal-pill font-semibold shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>Monaco IDE</span>
            </button>
          </div>

          {/* Split Ratio Selector (when in split mode) */}
          {layoutMode === "split" && (
            <select
              value={preferences.lessonSplitRatio || "50-50"}
              onChange={(e) =>
                onUpdatePreferences({
                  lessonSplitRatio: e.target.value as "35-65" | "50-50" | "60-40",
                })
              }
              aria-label="Split pane width ratio"
              className="hidden lg:block px-3.5 py-2 text-xs font-mono rounded-full bg-(--md-sys-color-surface-container-low) border border-(--md-sys-color-outline-variant) text-slate-700 dark:text-slate-300"
            >
              <option value="35-65">Ratio 35 / 65 (Wide IDE)</option>
              <option value="50-50">Ratio 42 / 58 (Balanced)</option>
              <option value="60-40">Ratio 58 / 42 (Wide Notes)</option>
            </select>
          )}

          <button
            type="button"
            onClick={handleDownloadLessonMarkdown}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium bg-(--md-sys-color-surface-container-low) border border-(--md-sys-color-outline-variant) text-slate-700 dark:text-slate-200 hover:bg-(--md-sys-color-surface-container-high) transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <DownloadSimple className="w-3.5 h-3.5" />
            <span>Export .md</span>
          </button>

          <button
            type="button"
            onClick={handleCopyFullLessonForAgent}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold m3-tonal-pill hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copiedAction === "bundle" ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>Copied Full Lesson</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Lesson for Argon</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setNewLessonTitle("");
              setNewLessonTopic("");
              setNewLessonTagsInput("");
              setIsCreatingLesson(true);
            }}
            style={{ backgroundColor: preferences.accentHex }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold text-white shadow-xs hover:opacity-95 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Lesson</span>
          </button>

          {lessons.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onDeleteLesson(activeLesson.id);
                onNotify(`Deleted lesson "${activeLesson.title}"`);
              }}
              title="Delete Current Lesson"
              className="p-2 rounded-full text-slate-400 hover:text-rose-500 hover:bg-(--md-sys-color-surface-container-high) transition-colors cursor-pointer"
            >
              <Trash className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Interactive Tag Filter Bar Across All Code Lessons */}
      {allLessonTags.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          <span className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 mr-1 shrink-0">
            <Tag className="w-3.5 h-3.5" />
            <span>Filter Lessons by Tag:</span>
          </span>
          {allLessonTags.map(([tag, count]) => {
            const isSelected = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleLessonTagFilter(tag)}
                className={`px-3 py-1 rounded-full text-xs font-mono transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isSelected
                    ? "m3-tonal-pill font-semibold"
                    : "bg-(--md-sys-color-surface-container-low) text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-(--md-sys-color-outline-variant)"
                }`}
              >
                #{tag} <span className="opacity-60 tabular-nums">({count})</span>
              </button>
            );
          })}
          {selectedTags.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedTags([])}
              className="px-2.5 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Clear tags ({selectedTags.length})
            </button>
          )}
        </div>
      )}

      {/* Main Split-Pane Workbench */}
      <div
        className={`grid gap-5 ${
          layoutMode === "split" ? "grid-cols-1 lg:grid-cols-12" : "grid-cols-1"
        }`}
      >
        {/* LEFT PANE: Markdown (.md) Lesson Guide & Source Editor */}
        {(layoutMode === "split" || layoutMode === "markdown-only") && (
          <section
            className={`${
              layoutMode === "split" ? leftColSpan : "col-span-1"
            } flex flex-col m3-card overflow-hidden h-[740px]`}
          >
            {/* Left Pane Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-(--md-sys-color-surface-container-low) border-b border-(--md-sys-color-outline-variant)">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                <span>LESSON_GUIDE.md</span>
                <span aria-hidden="true" className="text-slate-400">
                  ·
                </span>
                <span className="font-mono font-normal text-slate-500 tabular-nums">
                  {estimateTokenCount(activeLesson.markdownNotes)} tokens
                </span>
              </div>

              <div className="flex items-center gap-1 p-0.5 rounded-full bg-(--md-sys-color-surface-container-high)">
                <button
                  type="button"
                  onClick={() => setMarkdownEditMode("preview")}
                  className={`flex items-center gap-1 px-3 py-1 text-[11px] font-medium rounded-full transition-colors cursor-pointer ${
                    markdownEditMode === "preview"
                      ? "m3-tonal-pill font-semibold shadow-2xs"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  <span>Reader View</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMarkdownEditMode("source")}
                  className={`flex items-center gap-1 px-3 py-1 text-[11px] font-medium rounded-full transition-colors cursor-pointer ${
                    markdownEditMode === "source"
                      ? "m3-tonal-pill font-semibold shadow-2xs"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <Code className="w-3 h-3" />
                  <span>Edit .md in Monaco</span>
                </button>
              </div>
            </div>

            {/* Quick Section Jump Bar (Table of Contents) */}
            {markdownEditMode === "preview" && headings.length > 1 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-(--md-sys-color-surface-container-low)/60 border-b border-(--md-sys-color-outline-variant) overflow-x-auto text-xs text-slate-500">
                <span className="font-medium text-slate-700 dark:text-slate-300 shrink-0">
                  Sections:
                </span>
                {headings.map((h, idx) => (
                  <React.Fragment key={`${h.id}-${idx}`}>
                    <a
                      href={`#${h.id}`}
                      className="hover:text-indigo-600 dark:hover:text-indigo-400 whitespace-nowrap shrink-0 transition-colors"
                    >
                      {h.text}
                    </a>
                    {idx < headings.length - 1 && <span aria-hidden="true">·</span>}
                  </React.Fragment>
                ))}
              </div>
            )}

            {/* Left Pane Body */}
            <div className="flex-1 overflow-y-auto">
              {markdownEditMode === "preview" ? (
                <div className="p-6">
                  <MarkdownRenderer content={activeLesson.markdownNotes} onCopySuccess={onNotify} />
                </div>
              ) : (
                <Editor
                  height="100%"
                  path={`${activeLesson.id}-markdown-guide.md`}
                  language="markdown"
                  value={activeLesson.markdownNotes}
                  beforeMount={registerMaterial3MonacoThemes}
                  theme={preferences.mode === "dark" ? "forgevault-m3-dark" : "forgevault-m3-light"}
                  onChange={handleMarkdownNotesChange}
                  options={{
                    fontSize: preferences.editorFontSize,
                    fontFamily: "JetBrains Mono, monospace",
                    wordWrap: "on",
                    minimap: { enabled: false },
                    lineNumbers: preferences.editorLineNumbers ? "on" : "off",
                    scrollBeyondLastLine: false,
                    padding: { top: 16, bottom: 16 },
                  }}
                />
              )}
            </div>
          </section>
        )}

        {/* RIGHT PANE: Multi-File Monaco Editor IDE + Diff Compare + Sandbox Runner */}
        {(layoutMode === "split" || layoutMode === "code-only") && (
          <section
            className={`${
              layoutMode === "split" ? rightColSpan : "col-span-1"
            } flex flex-col m3-card overflow-hidden h-[740px]`}
          >
            {/* File Tabs Bar */}
            <div className="flex items-center justify-between px-3 py-2 bg-(--md-sys-color-surface-container-low) border-b border-(--md-sys-color-outline-variant) gap-2 overflow-x-auto">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {activeLesson.files.map((file) => {
                  const isActive = file.id === activeFile?.id;
                  const isRenaming = renamingFileId === file.id;

                  return (
                    <div
                      key={file.id}
                      className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono transition-colors whitespace-nowrap shrink-0 ${
                        isActive
                          ? "m3-tonal-pill font-semibold shadow-2xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-(--md-sys-color-surface-container-high)"
                      }`}
                    >
                      {isRenaming ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleCommitRenameFile(file.id);
                          }}
                          className="inline-flex items-center gap-1"
                        >
                          <input
                            type="text"
                            autoFocus
                            value={renameFileValue}
                            onChange={(e) => setRenameFileValue(e.target.value)}
                            onBlur={() => handleCommitRenameFile(file.id)}
                            className="w-28 px-2 py-0.5 text-xs font-mono rounded-full bg-(--md-sys-color-surface) border border-indigo-500 text-slate-900 dark:text-slate-100 focus:outline-none"
                          />
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSelectFileTab(file.id)}
                          onDoubleClick={() => {
                            setRenamingFileId(file.id);
                            setRenameFileValue(file.filename);
                          }}
                          title="Click to select tab, double-click to rename file"
                          className="flex items-center gap-1.5 cursor-pointer"
                        >
                          <FileCode className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{file.filename}</span>
                        </button>
                      )}

                      {!isRenaming && (
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingFileId(file.id);
                            setRenameFileValue(file.filename);
                          }}
                          title={`Rename ${file.filename}`}
                          className="opacity-0 group-hover:opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          <PencilSimple className="w-3 h-3" />
                        </button>
                      )}

                      {activeLesson.files.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteActiveFile(file.id)}
                          title={`Delete ${file.filename}`}
                          className="opacity-60 hover:opacity-100 hover:text-rose-500 transition-opacity cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Add New File Tab Trigger */}
                {isAddingFile ? (
                  <form onSubmit={handleAddNewFile} className="flex items-center gap-1">
                    <input
                      type="text"
                      autoFocus
                      value={newFilename}
                      onChange={(e) => setNewFilename(e.target.value)}
                      placeholder="e.g. schema.ts"
                      className="px-3 py-1 text-xs font-mono rounded-full bg-(--md-sys-color-surface) border border-indigo-500 text-slate-900 dark:text-slate-100 w-32 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="px-2.5 py-1 text-xs font-medium rounded-full bg-indigo-600 text-white cursor-pointer"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingFile(false)}
                      className="p-1 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingFile(true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-(--md-sys-color-surface-container-high) whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <FilePlus className="w-3.5 h-3.5" />
                    <span>Add File</span>
                  </button>
                )}
              </div>

              {/* Active File Controls: Sandbox Run, Diff Compare, Embed to .md, Language, Copy */}
              {activeFile && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {canRunInSandbox && (
                    <button
                      type="button"
                      disabled={isRunningSandbox}
                      onClick={handleRunActiveFileInSandbox}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      title="Execute TypeScript/JavaScript file in isolated Web Worker sandbox (async/await + 3s timeout guard)"
                    >
                      <Play className="w-3 h-3" />
                      <span>{isRunningSandbox ? "Running..." : "Run in Sandbox"}</span>
                    </button>
                  )}

                  {activeLesson.files.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setIsDiffMode(!isDiffMode)}
                      className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-mono rounded-full border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isDiffMode
                          ? "m3-tonal-pill border-transparent font-semibold"
                          : "border-(--md-sys-color-outline-variant) text-slate-600 dark:text-slate-300"
                      }`}
                      title="Compare two lesson files side by side in Monaco DiffEditor"
                    >
                      <GitDiff className="w-3 h-3" />
                      <span>Diff Compare</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleEmbedActiveFileIntoMarkdown}
                    className="hidden sm:flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium rounded-full border border-(--md-sys-color-outline-variant) text-slate-600 dark:text-slate-300 hover:bg-(--md-sys-color-surface-container-high) whitespace-nowrap shrink-0 cursor-pointer"
                    title="Append this file as a code block inside LESSON_GUIDE.md"
                  >
                    <ArrowLineLeft className="w-3 h-3" />
                    <span>Embed in .md</span>
                  </button>

                  <select
                    value={activeFile.language}
                    onChange={(e) => handleLanguageChange(e.target.value as MonacoLanguage)}
                    aria-label="Select syntax highlighting language"
                    className="px-2.5 py-1 text-xs font-mono rounded-full bg-(--md-sys-color-surface) border border-(--md-sys-color-outline-variant) text-slate-700 dark:text-slate-300"
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleCopyActiveFile}
                    style={
                      copiedAction === "file"
                        ? undefined
                        : { backgroundColor: preferences.accentHex }
                    }
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold text-white transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                      copiedAction === "file" ? "bg-emerald-600" : "hover:opacity-95"
                    }`}
                  >
                    {copiedAction === "file" ? (
                      <>
                        <Check className="w-3 h-3" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy File</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Diff Comparison Selector Bar (when Diff Mode is active) */}
            {isDiffMode && activeFile && secondaryDiffFile && (
              <div className="flex items-center justify-between px-4 py-2 m3-primary-container border-b border-(--md-sys-color-outline-variant) text-xs">
                <div className="flex items-center gap-2 font-mono">
                  <span className="opacity-75">Comparing Base:</span>
                  <select
                    value={secondaryDiffFile.id}
                    onChange={(e) => setCompareFileId(e.target.value)}
                    className="px-2.5 py-0.5 rounded-full bg-(--md-sys-color-surface) border border-(--md-sys-color-outline-variant) text-slate-900 dark:text-slate-100"
                  >
                    {activeLesson.files.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.filename}
                      </option>
                    ))}
                  </select>
                  <span>→</span>
                  <span className="font-semibold">{activeFile.filename} (Active Tab)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDiffMode(false)}
                  className="text-xs font-medium hover:underline cursor-pointer"
                >
                  Exit Diff Mode
                </button>
              </div>
            )}

            {/* Genuine Monaco Editor or DiffEditor Surface */}
            <div className="flex-1 relative min-h-0">
              {activeFile && !isDiffMode && (
                <Editor
                  height="100%"
                  path={`${activeLesson.id}/${activeFile.filename}`}
                  language={activeFile.language}
                  value={activeFile.content}
                  beforeMount={registerMaterial3MonacoThemes}
                  theme={preferences.mode === "dark" ? "forgevault-m3-dark" : "forgevault-m3-light"}
                  onChange={handleCodeChange}
                  options={{
                    fontSize: preferences.editorFontSize,
                    fontFamily: "JetBrains Mono, monospace",
                    fontLigatures: true,
                    wordWrap: preferences.editorWordWrap ? "on" : "off",
                    minimap: { enabled: preferences.editorMinimap },
                    lineNumbers: preferences.editorLineNumbers ? "on" : "off",
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    padding: { top: 16, bottom: 16 },
                  }}
                />
              )}

              {activeFile && isDiffMode && secondaryDiffFile && (
                <DiffEditor
                  height="100%"
                  language={activeFile.language}
                  original={secondaryDiffFile.content}
                  modified={activeFile.content}
                  beforeMount={registerMaterial3MonacoThemes}
                  theme={preferences.mode === "dark" ? "forgevault-m3-dark" : "forgevault-m3-light"}
                  options={{
                    fontSize: preferences.editorFontSize,
                    fontFamily: "JetBrains Mono, monospace",
                    renderSideBySide: true,
                    readOnly: true,
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                  }}
                />
              )}
            </div>

            {/* Live Sandbox Console Output Drawer */}
            {sandboxOutput && (
              <div className="h-44 bg-[#0C0E13] text-slate-100 border-t border-[#282C37] flex flex-col">
                <div className="flex items-center justify-between px-4 py-1.5 bg-[#181B21] border-b border-[#282C37] text-xs font-mono">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <TerminalWindow className="w-3.5 h-3.5" />
                    <span>Worker Sandbox Output ({activeFile?.filename})</span>
                    <span className="text-slate-500">·</span>
                    <span className="text-slate-400 tabular-nums">
                      {sandboxOutput.durationMs}ms
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSandboxOutput(null)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex-1 p-3.5 font-mono text-xs overflow-y-auto space-y-1.5">
                  {sandboxOutput.logs.map((log, idx) => (
                    <div key={idx} className="text-slate-200 whitespace-pre-wrap">
                      {log}
                    </div>
                  ))}
                  {sandboxOutput.returnValue && (
                    <div className="text-indigo-300 whitespace-pre-wrap pt-1 border-t border-slate-800/80">
                      <span className="text-slate-500">Return → </span>
                      {sandboxOutput.returnValue}
                    </div>
                  )}
                  {sandboxOutput.error && (
                    <div className="text-rose-400 whitespace-pre-wrap">
                      Runtime Error: {sandboxOutput.error}
                    </div>
                  )}
                  {sandboxOutput.logs.length === 0 &&
                    !sandboxOutput.returnValue &&
                    !sandboxOutput.error && (
                      <div className="text-slate-500">Executed cleanly with no console output.</div>
                    )}
                </div>
              </div>
            )}

            {/* Subtle IDE Footer with Real Buffer Info */}
            {activeFile && (
              <div className="flex items-center justify-between px-4 py-2 bg-(--md-sys-color-surface-container-low) border-t border-(--md-sys-color-outline-variant) text-[11px] font-mono text-slate-500 tabular-nums">
                <div className="flex items-center gap-3">
                  <span>{activeFile.filename}</span>
                  <span aria-hidden="true">·</span>
                  <span>{activeFile.language}</span>
                  <span aria-hidden="true">·</span>
                  <span>{activeFile.content.split("\n").length} lines</span>
                  <span aria-hidden="true">·</span>
                  <span>{estimateTokenCount(activeFile.content)} tokens</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdatePreferences({
                        editorWordWrap: !preferences.editorWordWrap,
                      })
                    }
                    className="hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                  >
                    Wrap: {preferences.editorWordWrap ? "ON" : "OFF"}
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdatePreferences({
                        editorMinimap: !preferences.editorMinimap,
                      })
                    }
                    className="hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                  >
                    Minimap: {preferences.editorMinimap ? "ON" : "OFF"}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Create or Edit Lesson Modal */}
      {(isCreatingLesson || isEditingLessonMeta) && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setIsCreatingLesson(false);
            setIsEditingLessonMeta(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md m3-dialog overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-(--md-sys-color-outline-variant)">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {isEditingLessonMeta ? "Edit Code Lesson Details" : "Create New Code Lesson"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setIsCreatingLesson(false);
                  setIsEditingLessonMeta(false);
                }}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={isEditingLessonMeta ? handleSaveEditedLessonMeta : handleCreateNewLesson}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Lesson Title
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newLessonTitle}
                  onChange={(e) => setNewLessonTitle(e.target.value)}
                  placeholder="e.g. Custom State Machine in TypeScript"
                  className="w-full px-3.5 py-2 text-sm rounded-xl bg-(--md-sys-color-surface-container-low) border border-(--md-sys-color-outline-variant) text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Topic Area
                </label>
                <input
                  type="text"
                  value={newLessonTopic}
                  onChange={(e) => setNewLessonTopic(e.target.value)}
                  placeholder="e.g. Systems & Architecture"
                  className="w-full px-3.5 py-2 text-sm rounded-xl bg-(--md-sys-color-surface-container-low) border border-(--md-sys-color-outline-variant) text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Custom Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={newLessonTagsInput}
                  onChange={(e) => setNewLessonTagsInput(e.target.value)}
                  placeholder="e.g. tauri-v2, rust, monaco"
                  className="w-full px-3.5 py-2 text-xs font-mono rounded-xl bg-(--md-sys-color-surface-container-low) border border-(--md-sys-color-outline-variant) text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Difficulty Level
                </label>
                <select
                  value={newLessonDifficulty}
                  onChange={(e) =>
                    setNewLessonDifficulty(
                      e.target.value as "Foundational" | "Intermediate" | "Advanced",
                    )
                  }
                  className="w-full px-3.5 py-2 text-sm rounded-xl bg-(--md-sys-color-surface-container-low) border border-(--md-sys-color-outline-variant) text-slate-900 dark:text-slate-100"
                >
                  <option value="Foundational">Foundational</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingLesson(false);
                    setIsEditingLessonMeta(false);
                  }}
                  className="px-4 py-2 text-xs font-medium rounded-full border border-(--md-sys-color-outline-variant) text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: preferences.accentHex }}
                  className="px-5 py-2 text-xs font-semibold rounded-full text-white shadow-xs cursor-pointer"
                >
                  {isEditingLessonMeta ? "Save Changes" : "Create Lesson Studio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
