import React, { useMemo, useState } from "react";
import {
  ArrowCounterClockwise,
  Check,
  ClockCounterClockwise,
  Copy,
  GitMerge,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  SlidersHorizontal,
  Star,
  Tag,
  Trash,
  Warning,
  X,
} from "./icons";
import {
  CopyFormat,
  PromptCategory,
  PromptItem,
  PromptVersionSnapshot,
  TargetAgent,
} from "../types/vault";
import {
  estimateTokenCount,
  extractTemplateVariables,
  formatPromptPayload,
  normalizeTagLabel,
} from "../services/vaultStorage";
import {
  DuplicateMatch,
  findPromptDuplicates,
  mergePromptItems,
} from "../services/duplicateDetector";

interface PromptsViewProps {
  prompts: PromptItem[];
  defaultCopyFormat: CopyFormat;
  accentHex: string;
  onSavePrompt: (prompt: PromptItem) => void;
  onDeletePrompt: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onIncrementCopy: (id: string) => void;
  onRecordClipboard?: (label: string, payload: string, kind: "prompt") => void;
  onNotify: (message: string) => void;
  externalCreateTrigger?: boolean;
  onClearExternalCreate?: () => void;
}

const CATEGORIES: Array<"All" | PromptCategory> = [
  "All",
  "Architecture",
  "System & Agent",
  "Refactoring",
  "Debugging",
  "UI & Design",
  "Testing & QA",
];

const AGENTS: Array<"All" | TargetAgent> = [
  "All",
  "Argon",
  "Universal",
  "Claude",
  "Cursor",
  "Windsurf",
];

export const PromptsView: React.FC<PromptsViewProps> = ({
  prompts,
  defaultCopyFormat,
  accentHex,
  onSavePrompt,
  onDeletePrompt,
  onToggleFavorite,
  onIncrementCopy,
  onRecordClipboard,
  onNotify,
  externalCreateTrigger,
  onClearExternalCreate,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"All" | PromptCategory>("All");
  const [selectedAgent, setSelectedAgent] = useState<"All" | TargetAgent>("All");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [copyFormat, setCopyFormat] = useState<CopyFormat>(defaultCopyFormat);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Inline card tag quick-add state
  const [inlineTagPromptId, setInlineTagPromptId] = useState<string | null>(null);
  const [inlineTagValue, setInlineTagValue] = useState("");

  // Active prompt for variable customization drawer
  const [customizingPromptId, setCustomizingPromptId] = useState<string | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});

  // Modal state for Create / Edit Prompt
  const [editingPrompt, setEditingPrompt] = useState<PromptItem | null>(null);
  const [modalTagInput, setModalTagInput] = useState("");
  const [versionNote, setVersionNote] = useState("");
  const [duplicateAlertIntercepted, setDuplicateAlertIntercepted] = useState(false);

  // Collection-wide duplicate scanner panel state
  const [showDuplicateScanner, setShowDuplicateScanner] = useState(false);
  const [skippedPairKeys, setSkippedPairKeys] = useState<string[]>([]);

  React.useEffect(() => {
    if (externalCreateTrigger) {
      handleOpenNewModal();
      onClearExternalCreate?.();
    }
  }, [externalCreateTrigger]);

  // Compute live duplicate matches for the currently edited/created prompt
  const activeDuplicateMatches = useMemo<DuplicateMatch<PromptItem>[]>(() => {
    if (!editingPrompt) return [];
    return findPromptDuplicates(editingPrompt, prompts, 55);
  }, [editingPrompt, prompts]);

  // Compute collection-wide duplicate pairs for the Duplicate Scanner drawer
  const collectionDuplicatePairs = useMemo(() => {
    const pairs: Array<{
      key: string;
      source: PromptItem;
      match: DuplicateMatch<PromptItem>;
    }> = [];
    const seen = new Set<string>();

    for (const p of prompts) {
      const matches = findPromptDuplicates(p, prompts, 55);
      for (const m of matches) {
        const pairKey = [p.id, m.existingItem.id].sort().join("::");
        if (!seen.has(pairKey) && !skippedPairKeys.includes(pairKey)) {
          seen.add(pairKey);
          pairs.push({ key: pairKey, source: p, match: m });
        }
      }
    }
    return pairs.sort((a, b) => b.match.overallSimilarity - a.match.overallSimilarity);
  }, [prompts, skippedPairKeys]);

  // Compute all unique tags with counts across Prompts
  const allPromptTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of prompts) {
      for (const t of p.tags || []) {
        counts.set(t, (counts.get(t) || 0) + 1);
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [prompts]);

  const toggleTagFilter = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const filteredPrompts = useMemo(() => {
    return prompts
      .filter((item) => {
        if (onlyFavorites && !item.isFavorite) return false;
        if (selectedCategory !== "All" && item.category !== selectedCategory) return false;
        if (selectedAgent !== "All" && item.targetAgent !== selectedAgent) return false;
        if (selectedTags.length > 0) {
          const itemTags = item.tags || [];
          const hasAllSelected = selectedTags.every((t) => itemTags.includes(t));
          if (!hasAllSelected) return false;
        }
        if (searchQuery.trim() !== "") {
          const q = searchQuery.toLowerCase();
          const matchTitle = item.title.toLowerCase().includes(q);
          const matchDesc = item.description.toLowerCase().includes(q);
          const matchContent = item.content.toLowerCase().includes(q);
          const matchAgent = item.targetAgent.toLowerCase().includes(q);
          const matchTag = (item.tags || []).some((t) => t.toLowerCase().includes(q));
          return matchTitle || matchDesc || matchContent || matchAgent || matchTag;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
        return b.copyCount - a.copyCount;
      });
  }, [prompts, onlyFavorites, selectedCategory, selectedAgent, selectedTags, searchQuery]);

  const handleCopyPrompt = async (
    prompt: PromptItem,
    customVars?: Record<string, string>,
    overrideFormat?: CopyFormat,
  ) => {
    const activeFormat = overrideFormat || copyFormat;
    const payload = formatPromptPayload(prompt, activeFormat, customVars);
    try {
      await navigator.clipboard.writeText(payload);
      setCopiedId(`${prompt.id}-${activeFormat}`);
      onIncrementCopy(prompt.id);
      onRecordClipboard?.(`${prompt.title} (${activeFormat.toUpperCase()})`, payload, "prompt");
      onNotify(
        `Copied "${prompt.title}" (${activeFormat.toUpperCase()}) for ${prompt.targetAgent}`,
      );
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      onNotify("Failed to access clipboard");
    }
  };

  const handleAddInlineTag = (prompt: PromptItem) => {
    const clean = normalizeTagLabel(inlineTagValue);
    if (!clean) {
      setInlineTagPromptId(null);
      return;
    }
    const existing = prompt.tags || [];
    if (!existing.includes(clean)) {
      onSavePrompt({
        ...prompt,
        tags: [...existing, clean],
        updatedAt: new Date().toISOString(),
      });
      onNotify(`Added tag #${clean} to "${prompt.title}"`);
    }
    setInlineTagValue("");
    setInlineTagPromptId(null);
  };

  const handleRemoveTagFromCard = (prompt: PromptItem, tagToRemove: string) => {
    onSavePrompt({
      ...prompt,
      tags: (prompt.tags || []).filter((t) => t !== tagToRemove),
      updatedAt: new Date().toISOString(),
    });
    onNotify(`Removed tag #${tagToRemove}`);
  };

  const handleToggleCustomizeDrawer = (prompt: PromptItem) => {
    if (customizingPromptId === prompt.id) {
      setCustomizingPromptId(null);
      return;
    }
    const defaults: Record<string, string> = {};
    for (const v of prompt.variables) {
      defaults[v.name] = v.defaultValue;
    }
    setVariableValues(defaults);
    setCustomizingPromptId(prompt.id);
  };

  const handleOpenNewModal = () => {
    setVersionNote("");
    setModalTagInput("");
    setDuplicateAlertIntercepted(false);
    setEditingPrompt({
      id: `prompt-${Date.now()}`,
      title: "",
      category: "Architecture",
      targetAgent: "Argon",
      tags: [],
      description: "",
      content: "",
      variables: [],
      versions: [],
      isFavorite: false,
      copyCount: 0,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleDuplicatePrompt = (prompt: PromptItem) => {
    setVersionNote("");
    setModalTagInput("");
    setDuplicateAlertIntercepted(true);
    setEditingPrompt({
      ...prompt,
      id: `prompt-${Date.now()}`,
      title: `${prompt.title} (Copy)`,
      copyCount: 0,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleInsertSnippetInEditor = (snippet: string) => {
    if (!editingPrompt) return;
    const nextContent = `${editingPrompt.content}\n${snippet}`;
    const syncedVars = extractTemplateVariables(nextContent, editingPrompt.variables);
    setEditingPrompt({
      ...editingPrompt,
      content: nextContent,
      variables: syncedVars,
    });
  };

  const handleAddTagInModal = () => {
    if (!editingPrompt) return;
    const clean = normalizeTagLabel(modalTagInput);
    if (!clean) return;
    const current = editingPrompt.tags || [];
    if (!current.includes(clean)) {
      setEditingPrompt({ ...editingPrompt, tags: [...current, clean] });
    }
    setModalTagInput("");
  };

  const finalizeSavePrompt = (promptToSave: PromptItem) => {
    const existingPrompt = prompts.find((p) => p.id === promptToSave.id);
    const previousVersions: PromptVersionSnapshot[] = [...(promptToSave.versions || [])];

    if (existingPrompt && existingPrompt.content !== promptToSave.content) {
      previousVersions.unshift({
        id: `ver-${Date.now()}`,
        savedAt: new Date().toISOString(),
        content: existingPrompt.content,
        note: versionNote.trim() || `Snapshot before edit (${new Date().toLocaleTimeString()})`,
      });
    }

    const syncedVariables = extractTemplateVariables(promptToSave.content, promptToSave.variables);
    onSavePrompt({
      ...promptToSave,
      title: promptToSave.title.trim(),
      description:
        promptToSave.description.trim() || "Custom reusable prompt template for AI coding agents.",
      tags: promptToSave.tags || [],
      variables: syncedVariables,
      versions: previousVersions.slice(0, 8),
      updatedAt: new Date().toISOString(),
    });
    setEditingPrompt(null);
    setVersionNote("");
    setDuplicateAlertIntercepted(false);
    onNotify(`Saved prompt "${promptToSave.title.trim()}"`);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPrompt || !editingPrompt.title.trim() || !editingPrompt.content.trim()) {
      return;
    }

    // Check Duplicate Detection before saving
    if (activeDuplicateMatches.length > 0 && !duplicateAlertIntercepted) {
      setDuplicateAlertIntercepted(true);
      onNotify(
        `Duplicate detected (${activeDuplicateMatches[0].overallSimilarity}% match with "${activeDuplicateMatches[0].existingItem.title}"). Choose Merge or Skip.`,
      );
      return;
    }

    finalizeSavePrompt(editingPrompt);
  };

  const handleMergeWithExisting = (targetExisting: PromptItem) => {
    if (!editingPrompt) return;
    const merged = mergePromptItems(targetExisting, editingPrompt);
    onSavePrompt(merged);
    // If editingPrompt was already saved in vault under a different ID, remove the redundant one
    if (prompts.some((p) => p.id === editingPrompt.id) && editingPrompt.id !== targetExisting.id) {
      onDeletePrompt(editingPrompt.id);
    }
    setEditingPrompt(null);
    setVersionNote("");
    setDuplicateAlertIntercepted(false);
    onNotify(
      `Merged into "${targetExisting.title}" (combined #tags, variables & saved version snapshot)`,
    );
  };

  const handleSkipDuplicateModal = () => {
    const skippedTitle = editingPrompt?.title?.trim() || "duplicate prompt";
    setEditingPrompt(null);
    setVersionNote("");
    setDuplicateAlertIntercepted(false);
    onNotify(`Skipped creating "${skippedTitle}"`);
  };

  return (
    <div className="space-y-5">
      {/* Workspace Header & Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-(--md-sys-color-outline-variant)">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Prompt Library
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Curated, parameterized system and task prompts with custom tagging, duplicate detection,
            and instant one-click copy for Argon.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Material 3 Segmented Copy Format Selector */}
          <div className="flex items-center gap-1 p-1 rounded-full bg-(--md-sys-color-surface-container-low) border border-(--md-sys-color-outline-variant)">
            {(["raw", "xml", "markdown", "json"] as CopyFormat[]).map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => setCopyFormat(fmt)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  copyFormat === fmt
                    ? "m3-tonal-pill font-semibold shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                {fmt === "raw"
                  ? "Raw Text"
                  : fmt === "xml"
                    ? "Agent XML"
                    : fmt === "markdown"
                      ? "Markdown"
                      : "System JSON"}
              </button>
            ))}
          </div>

          {/* Duplicate Detection Scanner Button */}
          <button
            type="button"
            onClick={() => setShowDuplicateScanner((prev) => !prev)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showDuplicateScanner || collectionDuplicatePairs.length > 0
                ? "bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300"
                : "bg-(--md-sys-color-surface-container-low) border-(--md-sys-color-outline-variant) text-slate-700 dark:text-slate-300 hover:bg-(--md-sys-color-surface-container-high)"
            }`}
          >
            <GitMerge className="w-3.5 h-3.5" />
            <span>
              Duplicate Check
              {collectionDuplicatePairs.length > 0 ? ` (${collectionDuplicatePairs.length})` : ""}
            </span>
          </button>

          <button
            type="button"
            onClick={handleOpenNewModal}
            style={{ backgroundColor: accentHex }}
            className="flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold text-white shadow-xs hover:opacity-95 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Prompt</span>
          </button>
        </div>
      </div>

      {/* Collection-Wide Duplicate Scanner Drawer */}
      {showDuplicateScanner && (
        <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Warning className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Prompt Duplicate Detection Utility — Title & Content Overlap Analysis
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowDuplicateScanner(false)}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
            >
              Close
            </button>
          </div>

          {collectionDuplicatePairs.length === 0 ? (
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Zero duplicate or high-overlap prompts detected across your {prompts.length} prompt
              templates (threshold: identical title or 55%+ content similarity).
            </p>
          ) : (
            <div className="space-y-2">
              {collectionDuplicatePairs.map(({ key, source, match }) => (
                <div
                  key={key}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-800/50 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      "{source.title}" <span className="text-slate-400 mx-1">↔</span> "
                      {match.existingItem.title}"
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 font-mono">
                      Title similarity: {match.titleSimilarity}% · Content overlap:{" "}
                      {match.contentSimilarity}% · {match.reasons.join(" · ")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const merged = mergePromptItems(match.existingItem, source);
                        onSavePrompt(merged);
                        onDeletePrompt(source.id);
                        onNotify(`Merged "${source.title}" into "${match.existingItem.title}"`);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold bg-amber-600 text-white hover:bg-amber-700 cursor-pointer"
                    >
                      <GitMerge className="w-3.5 h-3.5" />
                      <span>Merge</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSkippedPairKeys((prev) => [...prev, key])}
                      className="px-3 py-1.5 rounded-lg font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search & Interactive Category / Agent Filter Bar */}
      <div className="flex flex-col xl:flex-row gap-3 items-stretch xl:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlass className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter prompts by title, #tag, variable, or instruction..."
            className="w-full pl-11 pr-9 py-2.5 text-sm rounded-full bg-(--md-sys-color-surface-container-low) border border-(--md-sys-color-outline-variant) text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Segmented Filter */}
          <div className="flex items-center gap-1 p-1 rounded-full bg-(--md-sys-color-surface-container-low) border border-(--md-sys-color-outline-variant) overflow-x-auto">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedCategory === category
                    ? "m3-tonal-pill font-semibold shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Agent Filter */}
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value as "All" | TargetAgent)}
            aria-label="Filter by target AI agent"
            className="px-3.5 py-2 text-xs font-medium rounded-full bg-(--md-sys-color-surface-container-low) border border-(--md-sys-color-outline-variant) text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            {AGENTS.map((agent) => (
              <option key={agent} value={agent}>
                {agent === "All" ? "All Agents" : `Target: ${agent}`}
              </option>
            ))}
          </select>

          {/* Favorites Toggle */}
          <button
            type="button"
            onClick={() => setOnlyFavorites(!onlyFavorites)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              onlyFavorites
                ? "bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300"
                : "bg-(--md-sys-color-surface-container-low) border-(--md-sys-color-outline-variant) text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Star
              filled={onlyFavorites}
              className={`w-3.5 h-3.5 ${onlyFavorites ? "text-amber-400" : ""}`}
            />
            <span>Starred</span>
          </button>
        </div>
      </div>

      {/* Interactive Tag Filter Bar */}
      {allPromptTags.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          <span className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 mr-1 shrink-0">
            <Tag className="w-3.5 h-3.5" />
            <span>Filter by Tag:</span>
          </span>
          {allPromptTags.map(([tag, count]) => {
            const isSelected = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTagFilter(tag)}
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

      {/* Empty State */}
      {filteredPrompts.length === 0 ? (
        <div className="p-12 text-center m3-card">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            No matching prompts found
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Try clearing your active category or tag filters, or create a new reusable prompt
            template.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("All");
                setSelectedAgent("All");
                setSelectedTags([]);
                setOnlyFavorites(false);
              }}
              className="px-4 py-2 text-xs font-medium rounded-full border border-(--md-sys-color-outline-variant) text-slate-700 dark:text-slate-300 hover:bg-(--md-sys-color-surface-container-high) cursor-pointer"
            >
              Reset Filters
            </button>
            <button
              type="button"
              onClick={handleOpenNewModal}
              style={{ backgroundColor: accentHex }}
              className="px-5 py-2 text-xs font-semibold rounded-full text-white shadow-xs cursor-pointer"
            >
              Create First Prompt
            </button>
          </div>
        </div>
      ) : (
        /* Prompt Cards Grid */
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {filteredPrompts.map((prompt) => {
            const tokens = estimateTokenCount(prompt.content);
            const isCustomizing = customizingPromptId === prompt.id;
            const isCopiedMain = copiedId === `${prompt.id}-${copyFormat}`;
            const promptTags = prompt.tags || [];

            return (
              <article key={prompt.id} className="flex flex-col justify-between p-6 m3-card">
                <div>
                  {/* Card Top Metadata — Zero-Pill Inline Typography */}
                  <div className="flex items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400 mb-2">
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {prompt.category}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Optimized for {prompt.targetAgent}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{tokens} tokens</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{prompt.copyCount} copies</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onToggleFavorite(prompt.id)}
                        title={prompt.isFavorite ? "Remove from Starred" : "Star Prompt"}
                        className="p-1.5 rounded-md text-slate-400 hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <Star
                          filled={prompt.isFavorite}
                          className={`w-4 h-4 ${prompt.isFavorite ? "text-amber-400" : ""}`}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setVersionNote("");
                          setModalTagInput("");
                          setEditingPrompt(prompt);
                        }}
                        title="Edit Prompt & Tags"
                        className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <PencilSimple className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicatePrompt(prompt)}
                        title="Duplicate Prompt"
                        className="px-2 py-1 rounded-md text-[11px] font-medium text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        Clone
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDeletePrompt(prompt.id);
                          onNotify(`Deleted prompt "${prompt.title}"`);
                        }}
                        title="Delete Prompt"
                        className="p-1.5 rounded-md text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Primary Title & Description */}
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                    {prompt.title}
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                    {prompt.description}
                  </p>

                  {/* Code / Prompt Template Preview */}
                  <div className="mt-4 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/90 border border-slate-200/80 dark:border-slate-800/90 font-mono text-xs leading-relaxed text-slate-700 dark:text-slate-300 max-h-44 overflow-y-auto whitespace-pre-wrap">
                    {isCustomizing
                      ? formatPromptPayload(prompt, copyFormat, variableValues)
                      : prompt.content}
                  </div>

                  {/* Interactive Tag Row + Inline Add Tag */}
                  <div className="mt-3 flex items-center gap-2 flex-wrap text-xs">
                    {promptTags.map((tag) => {
                      const isActiveFilter = selectedTags.includes(tag);
                      return (
                        <span
                          key={tag}
                          className="group inline-flex items-center gap-1 font-mono text-slate-500 dark:text-slate-400"
                        >
                          <button
                            type="button"
                            onClick={() => toggleTagFilter(tag)}
                            className={`hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer ${
                              isActiveFilter
                                ? "text-indigo-600 dark:text-indigo-400 font-semibold underline underline-offset-4"
                                : ""
                            }`}
                          >
                            #{tag}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveTagFromCard(prompt, tag)}
                            title={`Remove #${tag}`}
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition-opacity cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}

                    {inlineTagPromptId === prompt.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleAddInlineTag(prompt);
                        }}
                        className="inline-flex items-center gap-1"
                      >
                        <input
                          type="text"
                          autoFocus
                          value={inlineTagValue}
                          onChange={(e) => setInlineTagValue(e.target.value)}
                          onBlur={() => handleAddInlineTag(prompt)}
                          placeholder="new-tag"
                          className="w-24 px-2 py-0.5 text-xs font-mono rounded bg-slate-100 dark:bg-slate-800 border border-indigo-500 text-slate-900 dark:text-slate-100 focus:outline-none"
                        />
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setInlineTagPromptId(prompt.id);
                          setInlineTagValue("");
                        }}
                        className="text-[11px] font-mono text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                      >
                        + tag
                      </button>
                    )}
                  </div>

                  {/* Template Variable Summary */}
                  {prompt.variables.length > 0 && !isCustomizing && (
                    <div className="mt-2.5 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        Variables ({prompt.variables.length}):
                      </span>
                      {prompt.variables.map((v, idx) => (
                        <React.Fragment key={v.name}>
                          <code className="font-mono text-indigo-600 dark:text-indigo-400">
                            {`{{${v.name}}}`}
                          </code>
                          {idx < prompt.variables.length - 1 && <span aria-hidden="true">·</span>}
                        </React.Fragment>
                      ))}
                    </div>
                  )}

                  {/* Interactive Variable Fill-In Drawer */}
                  {isCustomizing && prompt.variables.length > 0 && (
                    <div className="mt-4 p-4 rounded-lg bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                          Customize Template Variables Before Copying
                        </span>
                        <button
                          type="button"
                          onClick={() => setCustomizingPromptId(null)}
                          className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        >
                          Close
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {prompt.variables.map((variable) => (
                          <div key={variable.name}>
                            <label className="block text-[11px] font-mono text-slate-600 dark:text-slate-300 mb-1">
                              {`{{${variable.name}}}`}
                            </label>
                            <input
                              type="text"
                              value={variableValues[variable.name] ?? variable.defaultValue}
                              onChange={(e) =>
                                setVariableValues((prev) => ({
                                  ...prev,
                                  [variable.name]: e.target.value,
                                }))
                              }
                              className="w-full px-2.5 py-1.5 text-xs rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Bar: One-Click Copy & Variable Fill Trigger */}
                <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    {prompt.variables.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleToggleCustomizeDrawer(prompt)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          isCustomizing
                            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-transparent"
                            : "bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>
                          {isCustomizing ? "Hide Vars" : `Fill ${prompt.variables.length} Vars`}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        handleCopyPrompt(prompt, isCustomizing ? variableValues : undefined, "xml")
                      }
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {copiedId === `${prompt.id}-xml` ? "Copied XML!" : "Copy XML"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleCopyPrompt(prompt, isCustomizing ? variableValues : undefined, "json")
                      }
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {copiedId === `${prompt.id}-json` ? "Copied JSON!" : "JSON"}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleCopyPrompt(prompt, isCustomizing ? variableValues : undefined)
                    }
                    style={isCopiedMain ? undefined : { backgroundColor: accentHex }}
                    className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold shadow-xs transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                      isCopiedMain ? "bg-emerald-600 text-white" : "text-white hover:opacity-95"
                    }`}
                  >
                    {isCopiedMain ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied for {prompt.targetAgent}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Prompt</span>
                      </>
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Create / Edit Prompt Modal */}
      {editingPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs"
          onClick={() => setEditingPrompt(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Edit Prompt Template"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl m3-dialog overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-(--md-sys-color-outline-variant)">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {prompts.some((p) => p.id === editingPrompt.id)
                  ? "Edit Prompt Template, Tags & Snapshots"
                  : "Create New Prompt Template"}
              </h2>
              <button
                type="button"
                onClick={() => setEditingPrompt(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-6 space-y-4 max-h-[84vh] overflow-y-auto">
              {/* Live Duplicate Detection Alert Banner */}
              {activeDuplicateMatches.length > 0 && (
                <div
                  className={`p-4 rounded-xl border transition-all space-y-3 ${
                    duplicateAlertIntercepted
                      ? "bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 ring-2 ring-amber-400/30"
                      : "bg-amber-50/70 dark:bg-amber-950/25 border-amber-200 dark:border-amber-800/70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <Warning className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                          Duplicate Detection Alert — Similar Prompt Found in Vault
                        </div>
                        <p className="text-xs text-amber-800/90 dark:text-amber-300/90 mt-0.5">
                          This prompt shares a title or significant content overlap with{" "}
                          <span className="font-semibold">
                            "{activeDuplicateMatches[0].existingItem.title}"
                          </span>{" "}
                          ({activeDuplicateMatches[0].reasons.join(" · ")}). Choose whether to merge
                          into the existing prompt or skip creation:
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-300 shrink-0 tabular-nums">
                      {activeDuplicateMatches[0].overallSimilarity}% match
                    </span>
                  </div>

                  {/* Breakdown & Merge / Skip Resolution Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-amber-200/70 dark:border-amber-800/60 text-xs">
                    <div className="font-mono text-[11px] text-amber-800 dark:text-amber-300">
                      Title similarity: {activeDuplicateMatches[0].titleSimilarity}% · Content
                      overlap: {activeDuplicateMatches[0].contentSimilarity}% · Category:{" "}
                      {activeDuplicateMatches[0].existingItem.category}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          handleMergeWithExisting(activeDuplicateMatches[0].existingItem)
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer"
                      >
                        <GitMerge className="w-3.5 h-3.5" />
                        <span>Merge into "{activeDuplicateMatches[0].existingItem.title}"</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSkipDuplicateModal}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        Skip & Discard
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    required
                    value={editingPrompt.title}
                    onChange={(e) => setEditingPrompt({ ...editingPrompt, title: e.target.value })}
                    placeholder="e.g. Argon System Architect"
                    className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={editingPrompt.category}
                    onChange={(e) =>
                      setEditingPrompt({
                        ...editingPrompt,
                        category: e.target.value as PromptCategory,
                      })
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    {CATEGORIES.filter((c) => c !== "All").map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Target Agent
                  </label>
                  <select
                    value={editingPrompt.targetAgent}
                    onChange={(e) =>
                      setEditingPrompt({
                        ...editingPrompt,
                        targetAgent: e.target.value as TargetAgent,
                      })
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    {AGENTS.filter((a) => a !== "All").map((agent) => (
                      <option key={agent} value={agent}>
                        {agent}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Custom Tags Editor in Modal */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Custom Tags
                </label>
                <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  {(editingPrompt.tags || []).map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-200"
                    >
                      <span>#{t}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingPrompt({
                            ...editingPrompt,
                            tags: editingPrompt.tags.filter((item) => item !== t),
                          })
                        }
                        className="text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={modalTagInput}
                    onChange={(e) => setModalTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        handleAddTagInModal();
                      }
                    }}
                    placeholder="Type tag + Enter..."
                    className="flex-1 min-w-[140px] px-2 py-1 text-xs font-mono bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddTagInModal}
                    className="px-2.5 py-1 rounded text-xs font-medium bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Add Tag
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Summary / When to Use
                </label>
                <input
                  type="text"
                  value={editingPrompt.description}
                  onChange={(e) =>
                    setEditingPrompt({ ...editingPrompt, description: e.target.value })
                  }
                  placeholder="Brief 1-sentence description of what this prompt achieves..."
                  className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Prompt Template Body (Use{" "}
                    <code className="font-mono">{`{{variable_name}}`}</code> for dynamic fields)
                  </label>

                  {/* Quick-Insert Authoring Toolbar */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleInsertSnippetInEditor("{{new_variable}}")}
                      className="px-2 py-0.5 text-[11px] font-mono rounded bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 hover:bg-slate-200 cursor-pointer"
                    >
                      + {`{{variable}}`}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleInsertSnippetInEditor(
                          "\n<context>\n- Target runtime: {{runtime}}\n</context>",
                        )
                      }
                      className="px-2 py-0.5 text-[11px] font-mono rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                    >
                      + &lt;context&gt;
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleInsertSnippetInEditor(
                          "\n<constraints>\n- Zero placeholders or mock stubs\n- Strict TypeScript interfaces\n</constraints>",
                        )
                      }
                      className="px-2 py-0.5 text-[11px] font-mono rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                    >
                      + &lt;constraints&gt;
                    </button>
                    <span className="text-xs font-mono text-slate-400 tabular-nums ml-2">
                      {estimateTokenCount(editingPrompt.content)} tokens
                    </span>
                  </div>
                </div>
                <textarea
                  rows={8}
                  required
                  value={editingPrompt.content}
                  onChange={(e) => {
                    const nextContent = e.target.value;
                    const syncedVars = extractTemplateVariables(
                      nextContent,
                      editingPrompt.variables,
                    );
                    setEditingPrompt({
                      ...editingPrompt,
                      content: nextContent,
                      variables: syncedVars,
                    });
                  }}
                  className="w-full p-3.5 text-xs font-mono leading-relaxed rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Dynamic Variable Default Value Editor */}
              {editingPrompt.variables.length > 0 && (
                <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Detected Template Variables ({editingPrompt.variables.length}) — Set Default
                    Values
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {editingPrompt.variables.map((v, idx) => (
                      <div key={v.name} className="flex items-center gap-2">
                        <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 shrink-0">
                          {`{{${v.name}}}`}:
                        </span>
                        <input
                          type="text"
                          value={v.defaultValue}
                          onChange={(e) => {
                            const updated = [...editingPrompt.variables];
                            updated[idx] = { ...v, defaultValue: e.target.value };
                            setEditingPrompt({ ...editingPrompt, variables: updated });
                          }}
                          className="w-full px-2.5 py-1 text-xs rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Version History Rollback Section */}
              {editingPrompt.versions && editingPrompt.versions.length > 0 && (
                <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <ClockCounterClockwise className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Previous Prompt Snapshots ({editingPrompt.versions.length})</span>
                  </div>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {editingPrompt.versions.map((ver) => (
                      <div
                        key={ver.id}
                        className="flex items-center justify-between gap-2 p-2 rounded bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 text-xs"
                      >
                        <div className="truncate">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {ver.note}
                          </span>
                          <span className="text-slate-400 mx-1.5">·</span>
                          <span className="font-mono text-[11px] text-slate-400">
                            {ver.savedAt.slice(0, 10)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const synced = extractTemplateVariables(
                              ver.content,
                              editingPrompt.variables,
                            );
                            setEditingPrompt({
                              ...editingPrompt,
                              content: ver.content,
                              variables: synced,
                            });
                            onNotify("Restored snapshot content into editor");
                          }}
                          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 shrink-0 cursor-pointer"
                        >
                          <ArrowCounterClockwise className="w-3 h-3" />
                          <span>Restore</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <input
                  type="text"
                  value={versionNote}
                  onChange={(e) => setVersionNote(e.target.value)}
                  placeholder="Optional version snapshot note (e.g. Added strict XML tags)..."
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingPrompt(null)}
                    className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{ backgroundColor: accentHex }}
                    className="px-4 py-2 text-xs font-semibold rounded-lg text-white hover:opacity-95 cursor-pointer"
                  >
                    {activeDuplicateMatches.length > 0 && duplicateAlertIntercepted
                      ? "Save as Separate Anyway"
                      : "Save Prompt"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
