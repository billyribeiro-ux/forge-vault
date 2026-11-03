import { DEFAULT_THEME_PREFERENCES } from "../data/seedVault";
import {
  CodeLessonItem,
  MarkdownDocItem,
  PromptFolder,
  PromptItem,
  TechStackItem,
  ThemePreferences,
  VaultBackupBundle,
} from "../types/vault";

/**
 * Validated contents of a backup file. Collections that are absent from the file are `undefined`
 * and are left untouched on restore; collections that are present replace the current ones.
 */
export interface ParsedBackup {
  version: string;
  exportedAt: string | null;
  promptFolders?: PromptFolder[];
  prompts?: PromptItem[];
  stacks?: TechStackItem[];
  lessons?: CodeLessonItem[];
  markdownDocs?: MarkdownDocItem[];
  preferences?: ThemePreferences;
}

export type ParseBackupResult = { ok: true; backup: ParsedBackup } | { ok: false; error: string };

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function checkCollection<T>(
  raw: unknown,
  label: string,
  requiredStrings: string[],
  requiredArrays: string[],
  normalize: (item: UnknownRecord) => T,
): { ok: true; items: T[] | undefined } | { ok: false; error: string } {
  if (raw === undefined) return { ok: true, items: undefined };
  if (!Array.isArray(raw)) return { ok: false, error: `"${label}" must be a list` };

  const seenIds = new Set<string>();
  const items: T[] = [];
  for (const [index, item] of raw.entries()) {
    const where = `${label}[${index}]`;
    if (!isRecord(item)) return { ok: false, error: `${where} is not an object` };
    for (const key of requiredStrings) {
      if (!isString(item[key])) return { ok: false, error: `${where}.${key} must be text` };
    }
    for (const key of requiredArrays) {
      if (!Array.isArray(item[key])) return { ok: false, error: `${where}.${key} must be a list` };
    }
    const id = item.id as string;
    if (id.trim() === "") return { ok: false, error: `${where}.id is empty` };
    if (seenIds.has(id)) return { ok: false, error: `${where}.id "${id}" appears twice` };
    seenIds.add(id);
    items.push(normalize(item));
  }
  return { ok: true, items };
}

const nowIso = () => new Date().toISOString();

/**
 * Parses and validates a ForgeVault JSON backup. Invalid files are rejected with a specific
 * reason; nothing is partially imported.
 */
export function parseVaultBackup(text: string): ParseBackupResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `The file is not valid JSON (${detail})` };
  }
  if (!isRecord(data)) return { ok: false, error: "The file is not a ForgeVault backup object" };

  const collectionKeys = ["promptFolders", "prompts", "stacks", "lessons", "markdownDocs"];
  if (!collectionKeys.some((key) => key in data)) {
    return { ok: false, error: "The file contains no ForgeVault collections" };
  }

  const promptFolders = checkCollection<PromptFolder>(
    data.promptFolders,
    "promptFolders",
    ["id", "name"],
    [],
    (f) =>
      ({
        id: f.id as string,
        name: (f.name as string).trim() || "Untitled folder",
        createdAt: isString(f.createdAt) ? f.createdAt : nowIso(),
      }) as PromptFolder,
  );
  if (!promptFolders.ok) return promptFolders;
  const knownFolderIds = new Set((promptFolders.items ?? []).map((f) => f.id));

  const prompts = checkCollection<PromptItem>(
    data.prompts,
    "prompts",
    ["id", "title", "content"],
    [],
    (p) =>
      ({
        ...p,
        category: isString(p.category) ? p.category : "Architecture",
        targetAgent: isString(p.targetAgent) ? p.targetAgent : "Universal",
        description: isString(p.description) ? p.description : "",
        tags: isStringArray(p.tags) ? p.tags : [],
        variables: Array.isArray(p.variables) ? p.variables : [],
        versions: Array.isArray(p.versions) ? p.versions : [],
        isFavorite: p.isFavorite === true,
        copyCount: typeof p.copyCount === "number" ? p.copyCount : 0,
        updatedAt: isString(p.updatedAt) ? p.updatedAt : nowIso(),
        folderId: isString(p.folderId) && knownFolderIds.has(p.folderId) ? p.folderId : null,
      }) as PromptItem,
  );
  if (!prompts.ok) return prompts;

  const stacks = checkCollection<TechStackItem>(
    data.stacks,
    "stacks",
    ["id", "name"],
    [],
    (s) =>
      ({
        ...s,
        tagline: isString(s.tagline) ? s.tagline : "",
        layer: isString(s.layer) ? s.layer : "Full-Stack",
        tags: isStringArray(s.tags) ? s.tags : [],
        dependencies: Array.isArray(s.dependencies) ? s.dependencies : [],
        architectureRules: isStringArray(s.architectureRules) ? s.architectureRules : [],
        setupCommands: isString(s.setupCommands) ? s.setupCommands : "",
        agentContextBlock: isString(s.agentContextBlock) ? s.agentContextBlock : "",
        isFavorite: s.isFavorite === true,
        copyCount: typeof s.copyCount === "number" ? s.copyCount : 0,
        updatedAt: isString(s.updatedAt) ? s.updatedAt : nowIso(),
      }) as TechStackItem,
  );
  if (!stacks.ok) return stacks;

  const lessons = checkCollection<CodeLessonItem>(
    data.lessons,
    "lessons",
    ["id", "title"],
    ["files"],
    (l) => {
      const files = (l.files as unknown[]).filter(
        (f): f is UnknownRecord => isRecord(f) && isString(f.id) && isString(f.filename),
      );
      return {
        ...l,
        topic: isString(l.topic) ? l.topic : "",
        difficulty: isString(l.difficulty) ? l.difficulty : "Foundational",
        tags: isStringArray(l.tags) ? l.tags : [],
        summary: isString(l.summary) ? l.summary : "",
        markdownNotes: isString(l.markdownNotes) ? l.markdownNotes : "",
        files: files.map((f) => ({
          ...f,
          language: isString(f.language) ? f.language : "typescript",
          content: isString(f.content) ? f.content : "",
        })),
        activeFileId:
          isString(l.activeFileId) && files.some((f) => f.id === l.activeFileId)
            ? l.activeFileId
            : ((files[0]?.id as string | undefined) ?? ""),
        isFavorite: l.isFavorite === true,
        updatedAt: isString(l.updatedAt) ? l.updatedAt : nowIso(),
      } as CodeLessonItem;
    },
  );
  if (!lessons.ok) return lessons;

  const markdownDocs = checkCollection<MarkdownDocItem>(
    data.markdownDocs,
    "markdownDocs",
    ["id", "filename", "content"],
    [],
    (d) =>
      ({
        ...d,
        title: isString(d.title) ? d.title : (d.filename as string),
        category: isString(d.category) ? d.category : "Scratchpad",
        isFavorite: d.isFavorite === true,
        updatedAt: isString(d.updatedAt) ? d.updatedAt : nowIso(),
      }) as MarkdownDocItem,
  );
  if (!markdownDocs.ok) return markdownDocs;

  let preferences: ThemePreferences | undefined;
  if (data.preferences !== undefined) {
    if (!isRecord(data.preferences)) return { ok: false, error: '"preferences" must be an object' };
    preferences = {
      ...DEFAULT_THEME_PREFERENCES,
      ...(data.preferences as Partial<ThemePreferences>),
    };
  }

  return {
    ok: true,
    backup: {
      version: isString(data.version) ? data.version : "unknown",
      exportedAt: isString(data.exportedAt) ? data.exportedAt : null,
      promptFolders: promptFolders.items,
      prompts: prompts.items,
      stacks: stacks.items,
      lessons: lessons.items,
      markdownDocs: markdownDocs.items,
      preferences,
    },
  };
}

/** Human-readable summary such as "3 prompts, 1 stack, 0 lessons". */
export function describeBackupCounts(backup: ParsedBackup | VaultBackupBundle): string {
  const parts: string[] = [];
  const add = (items: unknown[] | undefined, singular: string, plural: string) => {
    if (items) parts.push(`${items.length} ${items.length === 1 ? singular : plural}`);
  };
  add(backup.promptFolders, "folder", "folders");
  add(backup.prompts, "prompt", "prompts");
  add(backup.stacks, "stack", "stacks");
  add(backup.lessons, "lesson", "lessons");
  add(backup.markdownDocs, "Markdown doc", "Markdown docs");
  return parts.join(", ");
}
