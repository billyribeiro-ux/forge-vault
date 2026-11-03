import { DEFAULT_THEME_PREFERENCES } from "../data/seedVault";
import {
  ClipboardHistoryEntry,
  CodeLessonItem,
  CopyFormat,
  MarkdownDocItem,
  PromptItem,
  PromptVariable,
  TechStackItem,
  ThemePreferences,
  VaultBackupBundle,
} from "../types/vault";

const LEGACY_DB_NAME = "forgevault_idb_v1";
const DB_NAME = "forgevault_idb_v2";
const DB_VERSION = 2;

const STORES = {
  prompts: "prompts",
  stacks: "stacks",
  lessons: "lessons",
  markdownDocs: "markdownDocs",
  preferences: "preferences",
  clipboardHistory: "clipboardHistory",
} as const;

let legacyPurged = false;
let dbInstancePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbInstancePromise) {
    return dbInstancePromise;
  }

  dbInstancePromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      dbInstancePromise = null;
      reject(new Error("IndexedDB is not available in this environment"));
      return;
    }

    if (!legacyPurged) {
      legacyPurged = true;
      try {
        indexedDB.deleteDatabase(LEGACY_DB_NAME);
      } catch {
        // Ignore
      }
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.prompts)) {
        db.createObjectStore(STORES.prompts, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.stacks)) {
        db.createObjectStore(STORES.stacks, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.lessons)) {
        db.createObjectStore(STORES.lessons, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.markdownDocs)) {
        db.createObjectStore(STORES.markdownDocs, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.preferences)) {
        db.createObjectStore(STORES.preferences, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.clipboardHistory)) {
        db.createObjectStore(STORES.clipboardHistory, { keyPath: "id" });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbInstancePromise = null;
      };
      db.onclose = () => {
        dbInstancePromise = null;
      };
      resolve(db);
    };

    request.onerror = () => {
      dbInstancePromise = null;
      reject(request.error);
    };
  });

  return dbInstancePromise;
}

async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as T[]) || []);
    req.onerror = () => reject(req.error);
  });
}

async function replaceAllInStore<T extends { id: string }>(
  storeName: string,
  items: T[],
): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.clear();
    for (const item of items) {
      store.put(item);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const pendingWriteTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleDebouncedStoreWrite<T extends { id: string }>(
  storeName: string,
  items: T[],
  delayMs = 220,
): void {
  const existing = pendingWriteTimers.get(storeName);
  if (existing) {
    clearTimeout(existing);
  }
  const timer = setTimeout(() => {
    pendingWriteTimers.delete(storeName);
    replaceAllInStore(storeName, items).catch(() => {
      // Ignore write error in restricted environments
    });
  }, delayMs);
  pendingWriteTimers.set(storeName, timer);
}

export async function loadInitialVaultState(): Promise<{
  prompts: PromptItem[];
  stacks: TechStackItem[];
  lessons: CodeLessonItem[];
  markdownDocs: MarkdownDocItem[];
  preferences: ThemePreferences;
  clipboardHistory: ClipboardHistoryEntry[];
}> {
  try {
    const [prompts, stacks, lessons, markdownDocs, prefsArr, clipboardHistory] = await Promise.all([
      getAllFromStore<PromptItem>(STORES.prompts),
      getAllFromStore<TechStackItem>(STORES.stacks),
      getAllFromStore<CodeLessonItem>(STORES.lessons),
      getAllFromStore<MarkdownDocItem>(STORES.markdownDocs),
      getAllFromStore<{ id: string; value: ThemePreferences }>(STORES.preferences),
      getAllFromStore<ClipboardHistoryEntry>(STORES.clipboardHistory),
    ]);

    const finalPrompts = prompts.map((p) => ({
      ...p,
      tags: Array.isArray(p.tags) ? p.tags : [],
    }));

    const finalStacks = stacks.map((s) => ({
      ...s,
      tags: Array.isArray(s.tags) ? s.tags : [],
    }));

    const finalLessons = lessons.map((l) => ({
      ...l,
      tags: Array.isArray(l.tags) ? l.tags : [],
    }));

    const storedPref = prefsArr.find((p) => p.id === "theme")?.value;
    const finalPreferences: ThemePreferences = storedPref
      ? { ...DEFAULT_THEME_PREFERENCES, ...storedPref }
      : DEFAULT_THEME_PREFERENCES;

    if (!storedPref) {
      await replaceAllInStore(STORES.preferences, [{ id: "theme", value: finalPreferences }]);
    }

    const sortedClipboard = [...clipboardHistory].sort((a, b) =>
      b.copiedAt.localeCompare(a.copiedAt),
    );

    return {
      prompts: finalPrompts,
      stacks: finalStacks,
      lessons: finalLessons,
      markdownDocs,
      preferences: finalPreferences,
      clipboardHistory: sortedClipboard,
    };
  } catch {
    return {
      prompts: [],
      stacks: [],
      lessons: [],
      markdownDocs: [],
      preferences: DEFAULT_THEME_PREFERENCES,
      clipboardHistory: [],
    };
  }
}

export async function clearAllVaultDataInDB(): Promise<void> {
  try {
    for (const timer of pendingWriteTimers.values()) {
      clearTimeout(timer);
    }
    pendingWriteTimers.clear();
    await Promise.all([
      replaceAllInStore(STORES.prompts, []),
      replaceAllInStore(STORES.stacks, []),
      replaceAllInStore(STORES.lessons, []),
      replaceAllInStore(STORES.markdownDocs, []),
      replaceAllInStore(STORES.clipboardHistory, []),
    ]);
  } catch {
    // Ignore
  }
}

export function savePromptsToDB(prompts: PromptItem[]): void {
  scheduleDebouncedStoreWrite(STORES.prompts, prompts, 120);
}

export function saveStacksToDB(stacks: TechStackItem[]): void {
  scheduleDebouncedStoreWrite(STORES.stacks, stacks, 120);
}

export function saveLessonsToDB(lessons: CodeLessonItem[]): void {
  scheduleDebouncedStoreWrite(STORES.lessons, lessons, 250);
}

export function saveMarkdownDocsToDB(docs: MarkdownDocItem[]): void {
  scheduleDebouncedStoreWrite(STORES.markdownDocs, docs, 250);
}

export function saveClipboardHistoryToDB(entries: ClipboardHistoryEntry[]): void {
  scheduleDebouncedStoreWrite(STORES.clipboardHistory, entries, 120);
}

export async function saveThemePreferencesToDB(preferences: ThemePreferences): Promise<void> {
  try {
    await replaceAllInStore(STORES.preferences, [{ id: "theme", value: preferences }]);
  } catch {
    // Ignore
  }
}

/**
 * Normalizes a custom tag label (lowercase, trimmed, hyphenated)
 */
export function normalizeTagLabel(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_.-]/g, "");
}

/**
 * Extracts {{variable_name}} tokens from a prompt template
 */
export function extractTemplateVariables(
  content: string,
  existingVariables: PromptVariable[] = [],
): PromptVariable[] {
  const regex = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;
  const foundNames = new Set<string>();
  let match: RegExpExecArray | null = regex.exec(content);

  while (match !== null) {
    foundNames.add(match[1]);
    match = regex.exec(content);
  }

  const existingMap = new Map(existingVariables.map((v) => [v.name, v]));

  return Array.from(foundNames).map((name) => {
    const existing = existingMap.get(name);
    return {
      name,
      defaultValue: existing?.defaultValue || `[${name}]`,
      description: existing?.description,
    };
  });
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Resolves {{variable}} placeholders safely (using function replacer to prevent $& / $$ corruption)
 * and wraps the prompt in the chosen CopyFormat.
 */
export function formatPromptPayload(
  prompt: PromptItem,
  format: CopyFormat,
  customValues?: Record<string, string>,
): string {
  let resolved = prompt.content;
  for (const variable of prompt.variables) {
    const val =
      customValues?.[variable.name] !== undefined
        ? customValues[variable.name]
        : variable.defaultValue;
    const escapedName = escapeRegExp(variable.name);
    const pattern = new RegExp(`\\{\\{\\s*${escapedName}\\s*\\}\\}`, "g");
    resolved = resolved.replace(pattern, () => val);
  }

  const tagsAttr = prompt.tags?.length ? ` tags="${prompt.tags.join(",")}"` : "";

  if (format === "xml") {
    return `<prompt title="${prompt.title}" category="${prompt.category}" target_agent="${prompt.targetAgent}"${tagsAttr}>\n${resolved.trim()}\n</prompt>`;
  }

  if (format === "markdown") {
    const tagsLine = prompt.tags?.length
      ? ` · Tags: ${prompt.tags.map((t) => `#${t}`).join(" ")}`
      : "";
    return `## Prompt: ${prompt.title}\n> Category: ${prompt.category} · Target Agent: ${prompt.targetAgent}${tagsLine}\n\n${resolved.trim()}`;
  }

  if (format === "json") {
    return JSON.stringify(
      {
        role: "system",
        title: prompt.title,
        targetAgent: prompt.targetAgent,
        category: prompt.category,
        tags: prompt.tags || [],
        content: resolved.trim(),
      },
      null,
      2,
    );
  }

  return resolved.trim();
}

export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

export function downloadTextFile(
  filename: string,
  content: string,
  mimeType = "text/markdown;charset=utf-8",
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function createVaultBackupBundle(state: {
  prompts: PromptItem[];
  stacks: TechStackItem[];
  lessons: CodeLessonItem[];
  markdownDocs: MarkdownDocItem[];
  preferences: ThemePreferences;
}): VaultBackupBundle {
  return {
    version: "2026.10.31",
    exportedAt: new Date().toISOString(),
    prompts: state.prompts,
    stacks: state.stacks,
    lessons: state.lessons,
    markdownDocs: state.markdownDocs,
    preferences: state.preferences,
  };
}
