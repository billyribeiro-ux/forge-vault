import { newId } from "../services/ids";
import React, { useMemo, useState } from "react";
import {
  BracketsCurly,
  Check,
  CheckSquare,
  Copy,
  DownloadSimple,
  Eye,
  FileCode,
  GitMerge,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Square,
  Stack,
  Star,
  Tag,
  TerminalWindow,
  Trash,
  Warning,
  X,
} from "./icons";
import { StackDependency, StackLayer, TechStackItem } from "../types/vault";
import { normalizeTagLabel } from "../services/vaultStorage";
import { describeSaveError, describeSaveResult, saveTextFile } from "../services/fileExport";
import {
  DuplicateMatch,
  findStackDuplicates,
  mergeStackItems,
} from "../services/duplicateDetector";

interface StacksViewProps {
  stacks: TechStackItem[];
  accentHex: string;
  onSaveStack: (stack: TechStackItem) => void;
  onDeleteStack: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onIncrementCopy: (id: string) => void;
  onRecordClipboard?: (label: string, payload: string, kind: "stack") => void;
  onNotify: (message: string) => void;
}

const LAYERS: Array<"All" | StackLayer> = [
  "All",
  "Full-Stack",
  "Desktop & Tauri",
  "Frontend",
  "Backend & Systems",
];

function buildManifestFromStack(stack: TechStackItem): string {
  const isRust = stack.layer === "Backend & Systems" || stack.name.toLowerCase().includes("rust");
  if (isRust) {
    const cargoLines = stack.dependencies
      .map((d) => `${d.name.split("/")[0].trim()} = "${d.version.replace(/^[\^~]/, "")}"`)
      .join("\n");
    return `[package]\nname = "${stack.name
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "-",
      )}"\nversion = "0.1.0"\nedition = "2024"\n\n[dependencies]\n${cargoLines}`;
  }

  const depsObj: Record<string, string> = {};
  for (const dep of stack.dependencies) {
    const cleanName = dep.name.split("/")[0].trim();
    depsObj[cleanName] = dep.version;
  }
  return JSON.stringify(
    {
      name: stack.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      private: true,
      version: "1.0.0",
      type: "module",
      dependencies: depsObj,
    },
    null,
    2,
  );
}

function buildConsolidatedStacksMarkdown(selectedStacks: TechStackItem[]): string {
  const exportedDate = new Date().toISOString().slice(0, 10);
  const allLayers = Array.from(new Set(selectedStacks.map((s) => s.layer)));
  const allTags = Array.from(new Set(selectedStacks.flatMap((s) => s.tags || [])));

  const headerLines = [
    `# ForgeVault — Consolidated Tech Stack Blueprints (${selectedStacks.length})`,
    `> Exported: ${exportedDate} · Layers: ${allLayers.join(", ")}${
      allTags.length ? ` · Tags: ${allTags.map((t) => `#${t}`).join(" ")}` : ""
    }`,
    "",
    "## Summary Index",
    "| # | Stack Blueprint | Layer | Core Packages | Tags |",
    "| :--- | :--- | :--- | :--- | :--- |",
    ...selectedStacks.map(
      (s, i) =>
        `| ${i + 1} | **${s.name}** | ${s.layer} | ${s.dependencies.length} packages | ${(
          s.tags || []
        )
          .map((t) => `\`#${t}\``)
          .join(" ")} |`,
    ),
    "",
    "---",
    "",
  ];

  const sections = selectedStacks.map((stack, index) => {
    const depRows = stack.dependencies.map(
      (d) => `| \`${d.name}\` | \`${d.version}\` | ${d.role} |`,
    );
    const ruleRows = stack.architectureRules.map((r, idx) => `${idx + 1}. ${r}`);
    const tagLine = (stack.tags || []).length
      ? ` · Tags: ${(stack.tags || []).map((t) => `#${t}`).join(" ")}`
      : "";

    return [
      `## ${index + 1}. ${stack.name}`,
      `**Layer:** ${stack.layer}${tagLine}`,
      "",
      `${stack.tagline}`,
      "",
      "### Core Packages & Versions",
      "| Package | Version | Architectural Role |",
      "| :--- | :--- | :--- |",
      ...depRows,
      "",
      "### Architectural Conventions",
      ...ruleRows,
      "",
      "### Bootstrap CLI Commands",
      "```bash",
      stack.setupCommands,
      "```",
      "",
      "### Argon / AI Agent Context Block",
      "```xml",
      stack.agentContextBlock,
      "```",
      "",
      "---",
      "",
    ].join("\n");
  });

  return [...headerLines, ...sections].join("\n").trim();
}

function buildConsolidatedStacksJson(selectedStacks: TechStackItem[]): string {
  const uniquePackages = Array.from(
    new Set(selectedStacks.flatMap((s) => s.dependencies.map((d) => d.name))),
  );
  const uniqueTags = Array.from(new Set(selectedStacks.flatMap((s) => s.tags || [])));

  return JSON.stringify(
    {
      bundleType: "forgevault.tech_stacks.consolidated",
      version: "2026.10.31",
      exportedAt: new Date().toISOString(),
      stackCount: selectedStacks.length,
      summary: {
        layers: Array.from(new Set(selectedStacks.map((s) => s.layer))),
        tags: uniqueTags,
        totalUniquePackages: uniquePackages.length,
      },
      stacks: selectedStacks.map((s) => ({
        id: s.id,
        name: s.name,
        layer: s.layer,
        tagline: s.tagline,
        tags: s.tags || [],
        dependencies: s.dependencies,
        architectureRules: s.architectureRules,
        setupCommands: s.setupCommands,
        agentContextBlock: s.agentContextBlock,
        generatedManifest: JSON.parse(
          buildManifestFromStack(s).startsWith("{")
            ? buildManifestFromStack(s)
            : JSON.stringify({ rawCargoToml: buildManifestFromStack(s) }),
        ),
      })),
    },
    null,
    2,
  );
}

function parseDepsFromText(depsText: string): StackDependency[] {
  return depsText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((s) => s.trim());
      return {
        name: parts[0] || "package",
        version: parts[1] || "latest",
        role: parts[2] || "Core dependency",
      };
    });
}

function parseRulesFromText(rulesText: string): string[] {
  return rulesText
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean);
}

export const StacksView: React.FC<StacksViewProps> = ({
  stacks,
  accentHex,
  onSaveStack,
  onDeleteStack,
  onToggleFavorite,
  onIncrementCopy,
  onRecordClipboard,
  onNotify,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLayer, setSelectedLayer] = useState<"All" | StackLayer>("All");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [editingStack, setEditingStack] = useState<TechStackItem | null>(null);
  const [modalTagInput, setModalTagInput] = useState("");
  const [rulesText, setRulesText] = useState("");
  const [depsText, setDepsText] = useState("");
  const [inlineRuleInputs, setInlineRuleInputs] = useState<Record<string, string>>({});
  const [duplicateAlertIntercepted, setDuplicateAlertIntercepted] = useState(false);

  // Bulk-Export Multi-Select state
  const [selectedStackIds, setSelectedStackIds] = useState<string[]>([]);
  const [showBulkExportStudio, setShowBulkExportStudio] = useState(false);
  const [bulkExportFormat, setBulkExportFormat] = useState<"markdown" | "json">("markdown");
  const [showBulkPreview, setShowBulkPreview] = useState(false);

  // Collection-wide duplicate scanner panel state
  const [showDuplicateScanner, setShowDuplicateScanner] = useState(false);
  const [skippedPairKeys, setSkippedPairKeys] = useState<string[]>([]);

  // Inline card tag quick-add state
  const [inlineTagStackId, setInlineTagStackId] = useState<string | null>(null);
  const [inlineTagValue, setInlineTagValue] = useState("");

  // Compute live duplicate matches for the stack currently being created/edited
  const activeDuplicateMatches = useMemo<DuplicateMatch<TechStackItem>[]>(() => {
    if (!editingStack) return [];
    const parsedDeps = parseDepsFromText(depsText);
    const parsedRules = parseRulesFromText(rulesText);
    return findStackDuplicates(
      {
        id: editingStack.id,
        name: editingStack.name,
        tagline: editingStack.tagline,
        dependencies: parsedDeps,
        architectureRules: parsedRules,
        agentContextBlock: editingStack.agentContextBlock,
      },
      stacks,
      55,
    );
  }, [editingStack, depsText, rulesText, stacks]);

  // Compute collection-wide duplicate stack pairs
  const collectionDuplicatePairs = useMemo(() => {
    const pairs: Array<{
      key: string;
      source: TechStackItem;
      match: DuplicateMatch<TechStackItem>;
    }> = [];
    const seen = new Set<string>();

    for (const s of stacks) {
      const matches = findStackDuplicates(s, stacks, 55);
      for (const m of matches) {
        const pairKey = [s.id, m.existingItem.id].sort().join("::");
        if (!seen.has(pairKey) && !skippedPairKeys.includes(pairKey)) {
          seen.add(pairKey);
          pairs.push({ key: pairKey, source: s, match: m });
        }
      }
    }
    return pairs.sort((a, b) => b.match.overallSimilarity - a.match.overallSimilarity);
  }, [stacks, skippedPairKeys]);

  // Compute all unique tags with counts across Tech Stacks
  const allStackTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of stacks) {
      for (const t of s.tags || []) {
        counts.set(t, (counts.get(t) || 0) + 1);
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [stacks]);

  const toggleTagFilter = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const filteredStacks = useMemo(() => {
    return stacks
      .filter((stack) => {
        if (selectedLayer !== "All" && stack.layer !== selectedLayer) return false;
        if (selectedTags.length > 0) {
          const itemTags = stack.tags || [];
          const hasAllSelected = selectedTags.every((t) => itemTags.includes(t));
          if (!hasAllSelected) return false;
        }
        if (searchQuery.trim() !== "") {
          const q = searchQuery.toLowerCase();
          const matchName = stack.name.toLowerCase().includes(q);
          const matchTagline = stack.tagline.toLowerCase().includes(q);
          const matchDeps = stack.dependencies.some(
            (d) => d.name.toLowerCase().includes(q) || d.role.toLowerCase().includes(q),
          );
          const matchTag = (stack.tags || []).some((t) => t.toLowerCase().includes(q));
          return matchName || matchTagline || matchDeps || matchTag;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
        return b.copyCount - a.copyCount;
      });
  }, [stacks, selectedLayer, selectedTags, searchQuery]);

  const handleCopyPayload = async (
    stack: TechStackItem,
    mode: "full" | "deps" | "rules" | "cli" | "manifest",
  ) => {
    let payload = "";
    if (mode === "full") {
      payload = stack.agentContextBlock;
    } else if (mode === "deps") {
      payload = stack.dependencies.map((d) => `- ${d.name} (${d.version}): ${d.role}`).join("\n");
    } else if (mode === "rules") {
      payload = `### Architecture Rules (${stack.name})\n${stack.architectureRules
        .map((r) => `- ${r}`)
        .join("\n")}`;
    } else if (mode === "manifest") {
      payload = buildManifestFromStack(stack);
    } else {
      payload = stack.setupCommands;
    }

    try {
      await navigator.clipboard.writeText(payload);
      const key = `${stack.id}-${mode}`;
      setCopiedKey(key);
      onIncrementCopy(stack.id);
      const label =
        mode === "full"
          ? "Full Stack Context Block"
          : mode === "deps"
            ? "Dependency Matrix"
            : mode === "rules"
              ? "Architecture Rules"
              : mode === "manifest"
                ? "Generated Manifest"
                : "CLI Setup Commands";
      onRecordClipboard?.(`${stack.name} (${label})`, payload, "stack");
      onNotify(`Copied ${label} for "${stack.name}"`);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      onNotify("Clipboard write failed");
    }
  };

  const handleAddInlineTag = (stack: TechStackItem) => {
    const clean = normalizeTagLabel(inlineTagValue);
    if (!clean) {
      setInlineTagStackId(null);
      return;
    }
    const existing = stack.tags || [];
    if (!existing.includes(clean)) {
      onSaveStack({
        ...stack,
        tags: [...existing, clean],
        updatedAt: new Date().toISOString(),
      });
      onNotify(`Added tag #${clean} to "${stack.name}"`);
    }
    setInlineTagValue("");
    setInlineTagStackId(null);
  };

  const handleRemoveTagFromCard = (stack: TechStackItem, tagToRemove: string) => {
    onSaveStack({
      ...stack,
      tags: (stack.tags || []).filter((t) => t !== tagToRemove),
      updatedAt: new Date().toISOString(),
    });
    onNotify(`Removed tag #${tagToRemove}`);
  };

  const handleAddInlineRule = (stack: TechStackItem) => {
    const newRule = (inlineRuleInputs[stack.id] || "").trim();
    if (!newRule) return;
    const updatedRules = [...stack.architectureRules, newRule];
    onSaveStack({
      ...stack,
      architectureRules: updatedRules,
      updatedAt: new Date().toISOString(),
    });
    setInlineRuleInputs((prev) => ({ ...prev, [stack.id]: "" }));
    onNotify(`Added architectural convention to "${stack.name}"`);
  };

  const openEditorForStack = (stack: TechStackItem, interceptDuplicates = false) => {
    setEditingStack(stack);
    setModalTagInput("");
    setDuplicateAlertIntercepted(interceptDuplicates);
    setRulesText(stack.architectureRules.join("\n"));
    setDepsText(stack.dependencies.map((d) => `${d.name} | ${d.version} | ${d.role}`).join("\n"));
  };

  const handleDuplicateStack = (stack: TechStackItem) => {
    const cloned: TechStackItem = {
      ...stack,
      id: newId("stack"),
      name: `${stack.name} (Copy)`,
      copyCount: 0,
      updatedAt: new Date().toISOString(),
    };
    openEditorForStack(cloned, true);
  };

  const handleCreateNewStack = () => {
    const fresh: TechStackItem = {
      id: newId("stack"),
      name: "",
      tagline: "",
      layer: "Full-Stack",
      tags: [],
      dependencies: [],
      architectureRules: [],
      setupCommands: "",
      agentContextBlock: "",
      isFavorite: false,
      copyCount: 0,
      updatedAt: new Date().toISOString(),
    };
    openEditorForStack(fresh, false);
  };

  const handleAddTagInModal = () => {
    if (!editingStack) return;
    const clean = normalizeTagLabel(modalTagInput);
    if (!clean) return;
    const current = editingStack.tags || [];
    if (!current.includes(clean)) {
      setEditingStack({ ...editingStack, tags: [...current, clean] });
    }
    setModalTagInput("");
  };

  const buildCandidateStackFromModal = (): TechStackItem | null => {
    if (!editingStack) return null;
    const parsedDeps = parseDepsFromText(depsText);
    const parsedRules = parseRulesFromText(rulesText);

    const autoContextBlock =
      editingStack.agentContextBlock.trim() ||
      `<tech_stack name="${editingStack.name.trim()}">\nLayer: ${
        editingStack.layer
      }\nDependencies:\n${parsedDeps
        .map((d) => `- ${d.name} (${d.version}): ${d.role}`)
        .join("\n")}\nConventions:\n${parsedRules.map((r) => `- ${r}`).join("\n")}\n</tech_stack>`;

    return {
      ...editingStack,
      name: editingStack.name.trim(),
      tagline: editingStack.tagline.trim(),
      tags: editingStack.tags || [],
      dependencies: parsedDeps,
      architectureRules: parsedRules,
      agentContextBlock: autoContextBlock,
      updatedAt: new Date().toISOString(),
    };
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStack || !editingStack.name.trim()) return;

    if (activeDuplicateMatches.length > 0 && !duplicateAlertIntercepted) {
      setDuplicateAlertIntercepted(true);
      onNotify(
        `Duplicate stack detected (${activeDuplicateMatches[0].overallSimilarity}% match with "${activeDuplicateMatches[0].existingItem.name}"). Choose Merge or Skip.`,
      );
      return;
    }

    const built = buildCandidateStackFromModal();
    if (!built) return;
    onSaveStack(built);
    setEditingStack(null);
    setDuplicateAlertIntercepted(false);
    onNotify(`Saved stack "${built.name}"`);
  };

  const handleMergeWithExistingStack = (targetExisting: TechStackItem) => {
    const candidate = buildCandidateStackFromModal();
    if (!candidate) return;
    const merged = mergeStackItems(targetExisting, candidate);
    onSaveStack(merged);
    if (stacks.some((s) => s.id === candidate.id) && candidate.id !== targetExisting.id) {
      onDeleteStack(candidate.id);
    }
    setEditingStack(null);
    setDuplicateAlertIntercepted(false);
    onNotify(
      `Merged into "${targetExisting.name}" (combined packages, architectural rules & #tags)`,
    );
  };

  const handleSkipDuplicateStackModal = () => {
    const skippedName = editingStack?.name?.trim() || "duplicate stack";
    setEditingStack(null);
    setDuplicateAlertIntercepted(false);
    onNotify(`Skipped creating "${skippedName}"`);
  };

  // Selected stack objects in current display order
  const selectedStackItems = useMemo(() => {
    const idSet = new Set(selectedStackIds);
    return stacks.filter((s) => idSet.has(s.id));
  }, [stacks, selectedStackIds]);

  // Consolidated export content preview (Markdown or JSON)
  const consolidatedPayload = useMemo(() => {
    if (selectedStackItems.length === 0) return "";
    return bulkExportFormat === "markdown"
      ? buildConsolidatedStacksMarkdown(selectedStackItems)
      : buildConsolidatedStacksJson(selectedStackItems);
  }, [selectedStackItems, bulkExportFormat]);

  const toggleSelectStack = (id: string) => {
    setSelectedStackIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      if (next.length > 0) {
        setShowBulkExportStudio(true);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    const ids = filteredStacks.map((s) => s.id);
    setSelectedStackIds(ids);
    setShowBulkExportStudio(true);
    onNotify(`Selected ${ids.length} tech stack${ids.length === 1 ? "" : "s"} for bulk export`);
  };

  const handleSelectStarredStacks = () => {
    const starredIds = stacks.filter((s) => s.isFavorite).map((s) => s.id);
    if (starredIds.length === 0) {
      onNotify("No starred stacks found — star one or more stacks first");
      return;
    }
    setSelectedStackIds(starredIds);
    setShowBulkExportStudio(true);
    onNotify(`Selected ${starredIds.length} starred stack${starredIds.length === 1 ? "" : "s"}`);
  };

  const handleDownloadConsolidatedBundle = (formatOverride?: "markdown" | "json") => {
    const targetFormat = formatOverride || bulkExportFormat;
    const targetStacks = selectedStackItems.length > 0 ? selectedStackItems : filteredStacks;

    if (targetStacks.length === 0) {
      onNotify("Select at least one tech stack to export");
      return;
    }

    const dateStamp = new Date().toISOString().slice(0, 10);
    const isMarkdown = targetFormat === "markdown";
    const fileName = `forgevault-stacks-bundle-${dateStamp}.${isMarkdown ? "md" : "json"}`;
    const contents = isMarkdown
      ? buildConsolidatedStacksMarkdown(targetStacks)
      : buildConsolidatedStacksJson(targetStacks);
    saveTextFile(
      fileName,
      contents,
      isMarkdown ? "text/markdown;charset=utf-8" : "application/json;charset=utf-8",
    )
      .then((result) => {
        const count = `${targetStacks.length} stack${targetStacks.length === 1 ? "" : "s"}`;
        onNotify(
          result.status === "cancelled"
            ? describeSaveResult(fileName, result)
            : `${describeSaveResult(fileName, result)} (${count})`,
        );
      })
      .catch((err: unknown) => onNotify(describeSaveError(fileName, err)));
  };

  const handleCopyConsolidatedBundle = async () => {
    const targetStacks = selectedStackItems.length > 0 ? selectedStackItems : filteredStacks;
    if (targetStacks.length === 0) {
      onNotify("Select at least one tech stack to copy");
      return;
    }

    const content =
      bulkExportFormat === "markdown"
        ? buildConsolidatedStacksMarkdown(targetStacks)
        : buildConsolidatedStacksJson(targetStacks);

    try {
      await navigator.clipboard.writeText(content);
      setCopiedKey(`bulk-${bulkExportFormat}`);
      onRecordClipboard?.(
        `Consolidated Stack Bundle (${targetStacks.length} stacks · ${bulkExportFormat.toUpperCase()})`,
        content,
        "stack",
      );
      onNotify(
        `Copied consolidated ${bulkExportFormat.toUpperCase()} bundle (${targetStacks.length} stacks) to clipboard`,
      );
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      onNotify("Clipboard write failed");
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-(--md-sys-color-outline-variant)">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Tech Stack Vault
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Canonical stack blueprints with custom tag filtering, duplicate detection, bulk
            JSON/Markdown export, and one-click context blocks for Argon.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => {
              const nextOpen = !showBulkExportStudio;
              setShowBulkExportStudio(nextOpen);
              if (nextOpen && selectedStackIds.length === 0 && filteredStacks.length > 0) {
                setSelectedStackIds(filteredStacks.map((s) => s.id));
              }
            }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showBulkExportStudio || selectedStackIds.length > 0
                ? "m3-tonal-pill border-transparent font-semibold"
                : "bg-(--md-sys-color-surface-container-low) border-(--md-sys-color-outline-variant) text-slate-700 dark:text-slate-300 hover:bg-(--md-sys-color-surface-container-high)"
            }`}
          >
            <DownloadSimple className="w-3.5 h-3.5" />
            <span>
              Bulk Export
              {selectedStackIds.length > 0 ? ` (${selectedStackIds.length})` : ""}
            </span>
          </button>

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
            onClick={handleCreateNewStack}
            style={{ backgroundColor: accentHex }}
            className="flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold text-white shadow-xs hover:opacity-95 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Tech Stack</span>
          </button>
        </div>
      </div>

      {/* Consolidated Bulk-Export Studio Drawer */}
      {(showBulkExportStudio || selectedStackIds.length > 0) && (
        <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-indigo-200 dark:border-indigo-900/70 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <DownloadSimple className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Bulk-Export Consolidated Tech Stack Bundle
                </h2>
                <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 tabular-nums">
                  · {selectedStackItems.length} of {stacks.length} selected
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Select multiple stacks below (or via each card's checkbox) to generate a single
                consolidated Markdown (<code className="font-mono">.md</code>) or JSON (
                <code className="font-mono">.json</code>) file for sharing or agent context
                injection.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
              >
                Select All ({filteredStacks.length})
              </button>
              <button
                type="button"
                onClick={handleSelectStarredStacks}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
              >
                Select Starred
              </button>
              {selectedStackIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedStackIds([])}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  Clear Selection
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowBulkExportStudio(false);
                  setSelectedStackIds([]);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                title="Close Bulk Export Studio"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Interactive Multi-Stack Selector Grid */}
          <div className="flex flex-wrap items-center gap-2">
            {stacks.map((stack) => {
              const isSelected = selectedStackIds.includes(stack.id);
              return (
                <button
                  key={stack.id}
                  type="button"
                  onClick={() => toggleSelectStack(stack.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-transparent shadow-xs"
                      : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  {isSelected ? (
                    <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <Square className="w-3.5 h-3.5 shrink-0 opacity-60" />
                  )}
                  <span>{stack.name}</span>
                  <span className="font-mono text-[11px] opacity-65">
                    ({stack.dependencies.length} pkgs)
                  </span>
                </button>
              );
            })}
          </div>

          {/* Consolidated Export Format & Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200/80 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setBulkExportFormat("markdown")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    bulkExportFormat === "markdown"
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Consolidated Markdown (.md)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBulkExportFormat("json")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    bulkExportFormat === "json"
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  <BracketsCurly className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Consolidated JSON (.json)</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowBulkPreview((prev) => !prev)}
                disabled={selectedStackItems.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{showBulkPreview ? "Hide Bundle Preview" : "Preview Bundle"}</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyConsolidatedBundle}
                disabled={selectedStackItems.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
              >
                {copiedKey === `bulk-${bulkExportFormat}` ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Copied Bundle!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy {bulkExportFormat.toUpperCase()} Bundle</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleDownloadConsolidatedBundle("markdown")}
                disabled={selectedStackItems.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90 disabled:opacity-40 cursor-pointer"
              >
                <DownloadSimple className="w-3.5 h-3.5" />
                <span>Download .MD ({selectedStackItems.length})</span>
              </button>

              <button
                type="button"
                onClick={() => handleDownloadConsolidatedBundle("json")}
                disabled={selectedStackItems.length === 0}
                style={{ backgroundColor: accentHex }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white hover:opacity-95 disabled:opacity-40 cursor-pointer"
              >
                <BracketsCurly className="w-3.5 h-3.5" />
                <span>Download .JSON ({selectedStackItems.length})</span>
              </button>
            </div>
          </div>

          {/* Live Consolidated Bundle Preview */}
          {showBulkPreview && selectedStackItems.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono">
                <span>
                  Consolidated {bulkExportFormat === "markdown" ? "Markdown (.md)" : "JSON (.json)"}{" "}
                  Preview ({selectedStackItems.length} stacks)
                </span>
                <span>{consolidatedPayload.length.toLocaleString()} chars</span>
              </div>
              <pre className="p-4 rounded-lg bg-slate-950 text-slate-200 font-mono text-xs leading-relaxed max-h-64 overflow-y-auto border border-slate-800 whitespace-pre-wrap">
                <code>{consolidatedPayload}</code>
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Collection-Wide Stack Duplicate Scanner Drawer */}
      {showDuplicateScanner && (
        <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Warning className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Tech Stack Duplicate Detection Utility — Name, Package & Context Overlap
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
              Zero duplicate or high-overlap tech stacks detected across your {stacks.length}{" "}
              blueprints (threshold: identical name or 55%+ package/content overlap).
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
                      "{source.name}" <span className="text-slate-400 mx-1">↔</span> "
                      {match.existingItem.name}"
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 font-mono">
                      Name similarity: {match.titleSimilarity}% · Blueprint overlap:{" "}
                      {match.contentSimilarity}% · {match.reasons.join(" · ")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const merged = mergeStackItems(match.existingItem, source);
                        onSaveStack(merged);
                        onDeleteStack(source.id);
                        onNotify(`Merged "${source.name}" into "${match.existingItem.name}"`);
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

      {/* Search & Layer Filter */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlass className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search stacks by framework, #tag, package, or architecture..."
            className="w-full pl-11 pr-9 py-2.5 text-sm rounded-full bg-(--md-sys-color-surface-container-low) border border-(--md-sys-color-outline-variant) text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 p-1 rounded-full bg-(--md-sys-color-surface-container-low) border border-(--md-sys-color-outline-variant) overflow-x-auto">
          {LAYERS.map((layer) => (
            <button
              key={layer}
              type="button"
              onClick={() => setSelectedLayer(layer)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                selectedLayer === layer
                  ? "m3-tonal-pill font-semibold shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {layer}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Tag Filter Bar */}
      {allStackTags.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          <span className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 mr-1 shrink-0">
            <Tag className="w-3.5 h-3.5" />
            <span>Filter by Tag:</span>
          </span>
          {allStackTags.map(([tag, count]) => {
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

      {/* Stack Blueprint Cards */}
      {filteredStacks.length === 0 ? (
        <div className="p-12 text-center m3-card">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {stacks.length === 0
              ? "Your Tech Stack Vault is empty"
              : "No matching tech stacks found"}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            {stacks.length === 0
              ? "Create your first tech stack blueprint to store dependencies, architectural conventions, and one-click context blocks."
              : "Clear your active layer or tag filters to view all stack blueprints."}
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            {(searchQuery || selectedLayer !== "All" || selectedTags.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedLayer("All");
                  setSelectedTags([]);
                }}
                className="px-4 py-2 text-xs font-medium rounded-full border border-(--md-sys-color-outline-variant) text-slate-700 dark:text-slate-300 hover:bg-(--md-sys-color-surface-container-high) cursor-pointer"
              >
                Reset Filters
              </button>
            )}
            <button
              type="button"
              onClick={handleCreateNewStack}
              style={{ backgroundColor: accentHex }}
              className="px-5 py-2 text-xs font-semibold rounded-full text-white shadow-xs cursor-pointer"
            >
              Create First Tech Stack
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredStacks.map((stack) => {
            const isFullCopied = copiedKey === `${stack.id}-full`;
            const isManifestCopied = copiedKey === `${stack.id}-manifest`;
            const stackTags = stack.tags || [];
            const isSelectedForBulk = selectedStackIds.includes(stack.id);

            return (
              <section
                key={stack.id}
                className={`p-6 m3-card ${isSelectedForBulk ? "ring-2 ring-indigo-500/40" : ""}`}
              >
                {/* Top Meta Line — Zero-Pill Inline Typography */}
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleSelectStack(stack.id)}
                      title={
                        isSelectedForBulk
                          ? "Deselect from bulk export"
                          : "Select stack for bulk JSON/Markdown export"
                      }
                      className={`mt-1 p-1 rounded-md transition-colors cursor-pointer ${
                        isSelectedForBulk
                          ? "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10"
                          : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      {isSelectedForBulk ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>

                    <div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {stack.layer}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {stack.dependencies.length} core packages
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {stack.architectureRules.length} conventions
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{stack.copyCount} copies</span>
                      </div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                        {stack.name}
                      </h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                        {stack.tagline}
                      </p>

                      {/* Interactive Stack Tags Row */}
                      <div className="mt-2.5 flex items-center gap-2 flex-wrap text-xs">
                        {stackTags.map((tag) => {
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
                                onClick={() => handleRemoveTagFromCard(stack, tag)}
                                title={`Remove #${tag}`}
                                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition-opacity cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          );
                        })}

                        {inlineTagStackId === stack.id ? (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleAddInlineTag(stack);
                            }}
                            className="inline-flex items-center gap-1"
                          >
                            <input
                              type="text"
                              autoFocus
                              value={inlineTagValue}
                              onChange={(e) => setInlineTagValue(e.target.value)}
                              onBlur={() => handleAddInlineTag(stack)}
                              placeholder="new-tag"
                              className="w-24 px-2 py-0.5 text-xs font-mono rounded bg-slate-100 dark:bg-slate-800 border border-indigo-500 text-slate-900 dark:text-slate-100 focus:outline-none"
                            />
                          </form>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setInlineTagStackId(stack.id);
                              setInlineTagValue("");
                            }}
                            className="text-[11px] font-mono text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                          >
                            + tag
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Primary One-Click Copy + Manifest + Edit Controls */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(stack.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Star Stack"
                    >
                      <Star
                        filled={stack.isFavorite}
                        className={`w-4 h-4 ${stack.isFavorite ? "text-amber-400" : ""}`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditorForStack(stack, false)}
                      className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Edit Stack Blueprint & Tags"
                    >
                      <PencilSimple className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicateStack(stack)}
                      title="Clone Stack Blueprint"
                      className="px-2 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Clone
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteStack(stack.id);
                        onNotify(`Deleted stack "${stack.name}"`);
                      }}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Delete Stack"
                    >
                      <Trash className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyPayload(stack, "manifest")}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <BracketsCurly className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{isManifestCopied ? "Copied Manifest!" : "Copy Manifest"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyPayload(stack, "full")}
                      style={isFullCopied ? undefined : { backgroundColor: accentHex }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                        isFullCopied ? "bg-emerald-600" : "hover:opacity-95"
                      }`}
                    >
                      {isFullCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied Stack for Argon</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Stack for Argon</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* 3-Column Stack Breakdown: Dependencies | Rules | Agent Context Preview */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-5">
                  {/* Column 1: Dependencies Table (5 cols) */}
                  <div className="lg:col-span-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <Stack className="w-3.5 h-3.5 text-slate-400" />
                          <span>Core Packages & Versions</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyPayload(stack, "deps")}
                          className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          {copiedKey === `${stack.id}-deps` ? "Copied!" : "Copy Packages"}
                        </button>
                      </div>

                      <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                              <th className="py-2 px-3 font-medium">Package</th>
                              <th className="py-2 px-3 font-medium">Version</th>
                              <th className="py-2 px-3 font-medium">Role</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {stack.dependencies.map((dep, idx) => (
                              <tr key={idx}>
                                <td className="py-2 px-3 font-mono font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                                  {dep.name}
                                </td>
                                <td className="py-2 px-3 font-mono tabular-nums text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                                  {dep.version}
                                </td>
                                <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                                  {dep.role}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* CLI Setup Commands */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <TerminalWindow className="w-3.5 h-3.5 text-slate-400" />
                          <span>Bootstrap Commands</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyPayload(stack, "cli")}
                          className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          {copiedKey === `${stack.id}-cli` ? "Copied!" : "Copy CLI"}
                        </button>
                      </div>
                      <pre className="p-3 rounded-lg bg-slate-950 text-slate-200 font-mono text-xs overflow-x-auto border border-slate-800">
                        <code>{stack.setupCommands}</code>
                      </pre>
                    </div>
                  </div>

                  {/* Column 2: Architectural Rules + Inline Quick-Add (3 cols) */}
                  <div className="lg:col-span-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          Architectural Conventions
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyPayload(stack, "rules")}
                          className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          {copiedKey === `${stack.id}-rules` ? "Copied!" : "Copy Rules"}
                        </button>
                      </div>
                      <ul className="space-y-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {stack.architectureRules.map((rule, idx) => (
                          <li
                            key={idx}
                            className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800/80"
                          >
                            <span className="font-mono font-semibold text-slate-400 mr-1.5 tabular-nums">
                              0{idx + 1}.
                            </span>
                            {rule}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Quick-Add Convention Input */}
                    <div className="mt-3 flex items-center gap-1.5">
                      <input
                        type="text"
                        value={inlineRuleInputs[stack.id] || ""}
                        onChange={(e) =>
                          setInlineRuleInputs((prev) => ({
                            ...prev,
                            [stack.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddInlineRule(stack);
                          }
                        }}
                        placeholder="Add stack rule + Enter..."
                        className="flex-1 px-2.5 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddInlineRule(stack)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Column 3: Ready-to-Paste Agent Context Block (4 cols) */}
                  <div className="lg:col-span-4 flex flex-col">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Argon / Agent Context Payload
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">XML + Markdown</span>
                    </div>
                    <pre className="flex-1 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs leading-relaxed text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap">
                      <code>{stack.agentContextBlock}</code>
                    </pre>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Create / Edit Stack Modal */}
      {editingStack && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs"
          onClick={() => setEditingStack(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Configure Tech Stack Blueprint"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl m3-dialog overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-(--md-sys-color-outline-variant)">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Configure Tech Stack Blueprint & Tags
              </h2>
              <button
                type="button"
                onClick={() => setEditingStack(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
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
                          Duplicate Detection Alert — Similar Tech Stack Found
                        </div>
                        <p className="text-xs text-amber-800/90 dark:text-amber-300/90 mt-0.5">
                          This stack shares a name or significant package/context overlap with{" "}
                          <span className="font-semibold">
                            "{activeDuplicateMatches[0].existingItem.name}"
                          </span>{" "}
                          ({activeDuplicateMatches[0].reasons.join(" · ")}). Choose whether to merge
                          into the existing stack or skip creation:
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
                      Name similarity: {activeDuplicateMatches[0].titleSimilarity}% · Content
                      overlap: {activeDuplicateMatches[0].contentSimilarity}% · Layer:{" "}
                      {activeDuplicateMatches[0].existingItem.layer}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          handleMergeWithExistingStack(activeDuplicateMatches[0].existingItem)
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer"
                      >
                        <GitMerge className="w-3.5 h-3.5" />
                        <span>Merge into "{activeDuplicateMatches[0].existingItem.name}"</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSkipDuplicateStackModal}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        Skip & Discard
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Stack Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editingStack.name}
                    onChange={(e) => setEditingStack({ ...editingStack, name: e.target.value })}
                    placeholder="e.g. Next.js 16 + Tauri v2 + Rust"
                    className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Stack Layer
                  </label>
                  <select
                    value={editingStack.layer}
                    onChange={(e) =>
                      setEditingStack({
                        ...editingStack,
                        layer: e.target.value as StackLayer,
                      })
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    {LAYERS.filter((l) => l !== "All").map((layer) => (
                      <option key={layer} value={layer}>
                        {layer}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Custom Tags Editor in Stack Modal */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Custom Stack Tags
                </label>
                <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  {(editingStack.tags || []).map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-200"
                    >
                      <span>#{t}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingStack({
                            ...editingStack,
                            tags: editingStack.tags.filter((item) => item !== t),
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
                  Tagline / Description
                </label>
                <input
                  type="text"
                  value={editingStack.tagline}
                  onChange={(e) => setEditingStack({ ...editingStack, tagline: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Dependencies (One per line:{" "}
                  <code className="font-mono">package | version | role</code>)
                </label>
                <textarea
                  rows={4}
                  value={depsText}
                  onChange={(e) => setDepsText(e.target.value)}
                  className="w-full p-3 text-xs font-mono rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Architectural Rules (One rule per line)
                </label>
                <textarea
                  rows={4}
                  value={rulesText}
                  onChange={(e) => setRulesText(e.target.value)}
                  className="w-full p-3 text-xs font-mono rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Argon Context Payload Block (
                  <code className="font-mono">&lt;tech_stack&gt;...&lt;/tech_stack&gt;</code>)
                </label>
                <textarea
                  rows={5}
                  value={editingStack.agentContextBlock}
                  onChange={(e) =>
                    setEditingStack({
                      ...editingStack,
                      agentContextBlock: e.target.value,
                    })
                  }
                  className="w-full p-3 text-xs font-mono rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingStack(null)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: accentHex }}
                  className="px-4 py-2 text-xs font-semibold rounded-lg text-white cursor-pointer"
                >
                  {activeDuplicateMatches.length > 0 && duplicateAlertIntercepted
                    ? "Save as Separate Anyway"
                    : "Save Stack Blueprint"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
