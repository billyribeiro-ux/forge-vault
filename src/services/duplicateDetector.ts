import { PromptItem, PromptVersionSnapshot, StackDependency, TechStackItem } from "../types/vault";
import { extractTemplateVariables } from "./vaultStorage";

export interface DuplicateMatch<T> {
  existingItem: T;
  titleSimilarity: number; // 0 - 100
  contentSimilarity: number; // 0 - 100
  overallSimilarity: number; // 0 - 100
  isExactTitle: boolean;
  reasons: string[];
}

/**
 * Normalizes text for similarity comparison
 */
function normalizeText(input: string): string {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Computes Dice-Sorensen bigram similarity between two strings (0 to 100)
 */
export function computeTextSimilarityPercent(a: string, b: string): number {
  const normA = normalizeText(a);
  const normB = normalizeText(b);

  if (!normA && !normB) return 100;
  if (!normA || !normB) return 0;
  if (normA === normB) return 100;

  if (normA.length < 2 || normB.length < 2) {
    return normA === normB ? 100 : 0;
  }

  const bigramsA = new Map<string, number>();
  for (let i = 0; i < normA.length - 1; i++) {
    const bg = normA.slice(i, i + 2);
    bigramsA.set(bg, (bigramsA.get(bg) || 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < normB.length - 1; i++) {
    const bg = normB.slice(i, i + 2);
    const count = bigramsA.get(bg) || 0;
    if (count > 0) {
      bigramsA.set(bg, count - 1);
      intersection++;
    }
  }

  const dice = (2 * intersection) / (normA.length - 1 + (normB.length - 1));

  // Also compute token-level Jaccard similarity for structural overlap
  const tokensA = new Set(normA.split(/[^a-z0-9_]+/).filter((t) => t.length > 2));
  const tokensB = new Set(normB.split(/[^a-z0-9_]+/).filter((t) => t.length > 2));
  let tokenIntersect = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) tokenIntersect++;
  }
  const tokenUnion = new Set([...tokensA, ...tokensB]).size;
  const jaccard = tokenUnion > 0 ? tokenIntersect / tokenUnion : 0;

  const blended = dice * 0.65 + jaccard * 0.35;
  return Math.min(100, Math.round(blended * 100));
}

/**
 * Detects existing prompts that share a title or significant content percentage with the candidate prompt
 */
export function findPromptDuplicates(
  candidate: Pick<PromptItem, "id" | "title" | "content" | "description" | "variables">,
  existingPrompts: PromptItem[],
  contentThresholdPercent = 55,
): DuplicateMatch<PromptItem>[] {
  const cleanTitle = normalizeText(candidate.title);
  const cleanContent = normalizeText(candidate.content);

  if (!cleanTitle && !cleanContent) return [];

  const matches: DuplicateMatch<PromptItem>[] = [];

  for (const existing of existingPrompts) {
    if (existing.id === candidate.id) continue;

    const existingTitle = normalizeText(existing.title);
    const isExactTitle = cleanTitle.length > 0 && cleanTitle === existingTitle;
    const titleSimilarity =
      cleanTitle.length > 0 ? computeTextSimilarityPercent(cleanTitle, existingTitle) : 0;
    const contentSimilarity =
      cleanContent.length > 0 ? computeTextSimilarityPercent(cleanContent, existing.content) : 0;

    const reasons: string[] = [];
    if (isExactTitle) {
      reasons.push("Identical title");
    } else if (titleSimilarity >= 78) {
      reasons.push(`${titleSimilarity}% title similarity`);
    }

    if (contentSimilarity >= contentThresholdPercent) {
      reasons.push(`${contentSimilarity}% template content overlap`);
    }

    const overallSimilarity = Math.max(
      titleSimilarity,
      contentSimilarity,
      Math.round(titleSimilarity * 0.4 + contentSimilarity * 0.6),
    );

    if (isExactTitle || titleSimilarity >= 78 || contentSimilarity >= contentThresholdPercent) {
      matches.push({
        existingItem: existing,
        titleSimilarity,
        contentSimilarity,
        overallSimilarity,
        isExactTitle,
        reasons,
      });
    }
  }

  return matches.sort((a, b) => b.overallSimilarity - a.overallSimilarity);
}

/**
 * Merges a new/incoming PromptItem into an existing PromptItem, preserving version history, tags, and variables
 */
export function mergePromptItems(existing: PromptItem, incoming: PromptItem): PromptItem {
  const mergedTags = Array.from(new Set([...(existing.tags || []), ...(incoming.tags || [])]));

  const previousVersions: PromptVersionSnapshot[] = [...(existing.versions || [])];
  if (normalizeText(existing.content) !== normalizeText(incoming.content)) {
    previousVersions.unshift({
      id: `ver-merge-${Date.now()}`,
      savedAt: new Date().toISOString(),
      content: existing.content,
      note: `Pre-merge snapshot before merging "${incoming.title || existing.title}"`,
    });
  }

  // Combine variables from both prompts
  const combinedVarPool = [...(existing.variables || []), ...(incoming.variables || [])];
  const nextContent = incoming.content.trim() || existing.content;
  const syncedVariables = extractTemplateVariables(nextContent, combinedVarPool);

  return {
    ...existing,
    title: existing.title || incoming.title.trim(),
    category: incoming.category || existing.category,
    targetAgent: incoming.targetAgent || existing.targetAgent,
    description:
      incoming.description.trim() &&
      incoming.description.trim() !== "Custom reusable prompt template for AI coding agents."
        ? incoming.description.trim()
        : existing.description,
    content: nextContent,
    tags: mergedTags,
    variables: syncedVariables,
    versions: previousVersions.slice(0, 10),
    isFavorite: existing.isFavorite || incoming.isFavorite,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Detects existing Tech Stacks that share a title or significant package/context overlap
 */
export function findStackDuplicates(
  candidate: {
    id: string;
    name: string;
    tagline?: string;
    dependencies: StackDependency[];
    architectureRules: string[];
    agentContextBlock: string;
  },
  existingStacks: TechStackItem[],
  contentThresholdPercent = 55,
): DuplicateMatch<TechStackItem>[] {
  const cleanName = normalizeText(candidate.name);
  if (!cleanName && candidate.dependencies.length === 0 && !candidate.agentContextBlock) {
    return [];
  }

  const candidateSummary = [
    candidate.dependencies.map((d) => `${d.name} ${d.role}`).join(" "),
    candidate.architectureRules.join(" "),
    candidate.agentContextBlock,
  ].join("\n");

  const candidatePkgNames = new Set(
    candidate.dependencies.map((d) => normalizeText(d.name.split("/")[0])),
  );

  const matches: DuplicateMatch<TechStackItem>[] = [];

  for (const existing of existingStacks) {
    if (existing.id === candidate.id) continue;

    const existingName = normalizeText(existing.name);
    const isExactTitle = cleanName.length > 0 && cleanName === existingName;
    const titleSimilarity =
      cleanName.length > 0 ? computeTextSimilarityPercent(cleanName, existingName) : 0;

    const existingSummary = [
      existing.dependencies.map((d) => `${d.name} ${d.role}`).join(" "),
      existing.architectureRules.join(" "),
      existing.agentContextBlock,
    ].join("\n");

    const textSim = computeTextSimilarityPercent(candidateSummary, existingSummary);

    // Also compute package overlap ratio
    const existingPkgNames = new Set(
      existing.dependencies.map((d) => normalizeText(d.name.split("/")[0])),
    );
    let sharedPkgCount = 0;
    for (const pkg of candidatePkgNames) {
      if (pkg && existingPkgNames.has(pkg)) sharedPkgCount++;
    }
    const maxPkgs = Math.max(candidatePkgNames.size, existingPkgNames.size, 1);
    const pkgOverlapPercent = Math.round((sharedPkgCount / maxPkgs) * 100);

    const contentSimilarity = Math.max(
      textSim,
      Math.round(textSim * 0.6 + pkgOverlapPercent * 0.4),
    );

    const reasons: string[] = [];
    if (isExactTitle) {
      reasons.push("Identical stack name");
    } else if (titleSimilarity >= 78) {
      reasons.push(`${titleSimilarity}% stack name similarity`);
    }

    if (pkgOverlapPercent >= 60 && sharedPkgCount >= 2) {
      reasons.push(`${pkgOverlapPercent}% shared core packages (${sharedPkgCount} packages)`);
    }
    if (contentSimilarity >= contentThresholdPercent) {
      reasons.push(`${contentSimilarity}% blueprint content overlap`);
    }

    const overallSimilarity = Math.max(titleSimilarity, contentSimilarity);

    if (isExactTitle || titleSimilarity >= 78 || contentSimilarity >= contentThresholdPercent) {
      matches.push({
        existingItem: existing,
        titleSimilarity,
        contentSimilarity,
        overallSimilarity,
        isExactTitle,
        reasons,
      });
    }
  }

  return matches.sort((a, b) => b.overallSimilarity - a.overallSimilarity);
}

/**
 * Merges an incoming TechStackItem into an existing TechStackItem
 */
export function mergeStackItems(existing: TechStackItem, incoming: TechStackItem): TechStackItem {
  const mergedTags = Array.from(new Set([...(existing.tags || []), ...(incoming.tags || [])]));

  // Merge dependencies by package name
  const depMap = new Map<string, StackDependency>();
  for (const d of existing.dependencies) {
    depMap.set(normalizeText(d.name), d);
  }
  for (const d of incoming.dependencies) {
    depMap.set(normalizeText(d.name), d);
  }
  const mergedDeps = Array.from(depMap.values());

  // Merge architecture rules (deduplicate case-insensitively)
  const ruleMap = new Map<string, string>();
  for (const r of existing.architectureRules) {
    ruleMap.set(normalizeText(r), r);
  }
  for (const r of incoming.architectureRules) {
    const key = normalizeText(r);
    if (!ruleMap.has(key)) {
      ruleMap.set(key, r);
    }
  }
  const mergedRules = Array.from(ruleMap.values());

  const mergedContextBlock = `<tech_stack name="${existing.name}">\nLayer: ${
    existing.layer
  }\nDependencies:\n${mergedDeps
    .map((d) => `- ${d.name} (${d.version}): ${d.role}`)
    .join("\n")}\nConventions:\n${mergedRules.map((r) => `- ${r}`).join("\n")}\n</tech_stack>`;

  return {
    ...existing,
    tagline: incoming.tagline.trim() || existing.tagline,
    tags: mergedTags,
    dependencies: mergedDeps,
    architectureRules: mergedRules,
    setupCommands:
      incoming.setupCommands && incoming.setupCommands !== existing.setupCommands
        ? `${existing.setupCommands}\n${incoming.setupCommands}`
        : existing.setupCommands,
    agentContextBlock: mergedContextBlock,
    isFavorite: existing.isFavorite || incoming.isFavorite,
    updatedAt: new Date().toISOString(),
  };
}
