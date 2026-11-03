import { DEFAULT_THEME_PREFERENCES } from "../data/seedVault";
import {
  ClipboardHistoryEntry,
  CodeLessonItem,
  CopyFormat,
  MarkdownDocItem,
  PromptFolder,
  PromptItem,
  PromptVariable,
  TechStackItem,
  ThemePreferences,
  VaultBackupBundle,
} from "../types/vault";

export const BACKUP_FORMAT_VERSION = "2026.10.31";

const DB_NAME = "forgevault_idb_v2";
// v3 adds the promptFolders store. Upgrades only add missing stores; they never drop data.
const DB_VERSION = 3;

/**
 * `forgevault_idb_v1` was the database name before v2. Earlier builds deleted it on every launch
 * without migrating it. It is now left untouched so any surviving data can still be recovered.
 */
export const LEGACY_DB_NAME = "forgevault_idb_v1";

const STORES = {
  promptFolders: "promptFolders",
  prompts: "prompts",
  stacks: "stacks",
  lessons: "lessons",
  markdownDocs: "markdownDocs",
  preferences: "preferences",
  clipboardHistory: "clipboardHistory",
} as const;

type StoreName = (typeof STORES)[keyof typeof STORES];

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

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of Object.values(STORES)) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: "id" });
        }
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
      reject(request.error ?? new Error("Failed to open the ForgeVault database"));
    };

    request.onblocked = () => {
      dbInstancePromise = null;
      reject(new Error("The ForgeVault database is open in another window with an older version"));
    };
  });

  return dbInstancePromise;
}

async function getAllFromStore<T>(storeName: StoreName): Promise<T[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve((req.result as T[]) || []);
    req.onerror = () => reject(req.error ?? new Error(`Failed to read ${storeName}`));
  });
}

/**
 * Replaces the full contents of one store inside a single readwrite transaction. The clear and the
 * puts commit together or not at all, so an interrupted write never leaves a half-empty store.
 */
async function replaceAllInStore<T extends { id: string }>(
  storeName: StoreName,
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
    tx.onerror = () => reject(tx.error ?? new Error(`Failed to write ${storeName}`));
    tx.onabort = () => reject(tx.error ?? new Error(`Write to ${storeName} was aborted`));
  });
}

// ---------------------------------------------------------------------------
// Debounced write queue with explicit flush and error reporting
// ---------------------------------------------------------------------------

export type PersistenceStatus =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "error"; message: string };

type StatusListener = (status: PersistenceStatus) => void;

interface PendingWrite {
  timer: ReturnType<typeof setTimeout>;
  run: () => Promise<void>;
}

const pendingWrites = new Map<StoreName, PendingWrite>();
const inFlightWrites = new Set<Promise<void>>();
const statusListeners = new Set<StatusListener>();
const writeErrors = new Map<StoreName, string>();

function emitStatus(): void {
  const firstError = writeErrors.values().next();
  const status: PersistenceStatus = !firstError.done
    ? { state: "error", message: firstError.value }
    : pendingWrites.size > 0 || inFlightWrites.size > 0
      ? { state: "saving" }
      : { state: "idle" };
  for (const listener of statusListeners) {
    listener(status);
  }
}

/** Subscribes to save status changes. Returns an unsubscribe function. */
export function subscribePersistenceStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

function startWrite(storeName: StoreName, run: () => Promise<void>): Promise<void> {
  const write = run()
    .then(() => {
      writeErrors.delete(storeName);
    })
    .catch((err: unknown) => {
      const detail = err instanceof Error ? err.message : String(err);
      writeErrors.set(storeName, `Could not save ${storeName}: ${detail}`);
      console.error("[ForgeVault] persistence failure", storeName, err);
    })
    .finally(() => {
      inFlightWrites.delete(write);
      emitStatus();
    });
  inFlightWrites.add(write);
  emitStatus();
  return write;
}

function scheduleDebouncedStoreWrite<T extends { id: string }>(
  storeName: StoreName,
  items: T[],
  delayMs: number,
): void {
  const existing = pendingWrites.get(storeName);
  if (existing) {
    clearTimeout(existing.timer);
  }
  const run = () => replaceAllInStore(storeName, items);
  const timer = setTimeout(() => {
    pendingWrites.delete(storeName);
    void startWrite(storeName, run);
  }, delayMs);
  pendingWrites.set(storeName, { timer, run });
  emitStatus();
}

/**
 * Starts every debounced write immediately and resolves when all writes have settled.
 * Called when the window is hidden or closed so recent edits are not lost.
 */
export function flushPendingWrites(): Promise<void> {
  for (const [storeName, pending] of pendingWrites) {
    clearTimeout(pending.timer);
    pendingWrites.delete(storeName);
    void startWrite(storeName, pending.run);
  }
  return Promise.all(inFlightWrites).then(() => undefined);
}

export function hasPendingWrites(): boolean {
  return pendingWrites.size > 0 || inFlightWrites.size > 0;
}

// ---------------------------------------------------------------------------
// Load / save API
// ---------------------------------------------------------------------------

export interface VaultState {
  promptFolders: PromptFolder[];
  prompts: PromptItem[];
  stacks: TechStackItem[];
  lessons: CodeLessonItem[];
  markdownDocs: MarkdownDocItem[];
  preferences: ThemePreferences;
  clipboardHistory: ClipboardHistoryEntry[];
}

/**
 * Loads the vault from IndexedDB. Rejects when storage cannot be read: callers must show an
 * error and must not write, because writing an empty state would replace the user's data.
 */
export async function loadInitialVaultState(): Promise<VaultState> {
  const [promptFolders, prompts, stacks, lessons, markdownDocs, prefsArr, clipboardHistory] =
    await Promise.all([
    getAllFromStore<PromptFolder>(STORES.promptFolders),
    getAllFromStore<PromptItem>(STORES.prompts),
    getAllFromStore<TechStackItem>(STORES.stacks),
    getAllFromStore<CodeLessonItem>(STORES.lessons),
    getAllFromStore<MarkdownDocItem>(STORES.markdownDocs),
    getAllFromStore<{ id: string; value: ThemePreferences }>(STORES.preferences),
    getAllFromStore<ClipboardHistoryEntry>(STORES.clipboardHistory),
  ]);

  const storedPref = prefsArr.find((p) => p.id === "theme")?.value;

  const folderIds = new Set(promptFolders.map((f) => f.id));
  return {
    promptFolders: [...promptFolders].sort((a, b) => a.name.localeCompare(b.name)),
    prompts: prompts.map((p) => ({
      ...p,
      tags: Array.isArray(p.tags) ? p.tags : [],
      folderId: p.folderId && folderIds.has(p.folderId) ? p.folderId : null,
    })),
    stacks: stacks.map((s) => ({ ...s, tags: Array.isArray(s.tags) ? s.tags : [] })),
    lessons: lessons.map((l) => ({ ...l, tags: Array.isArray(l.tags) ? l.tags : [] })),
    markdownDocs,
    preferences: storedPref
      ? { ...DEFAULT_THEME_PREFERENCES, ...storedPref }
      : DEFAULT_THEME_PREFERENCES,
    clipboardHistory: [...clipboardHistory].sort((a, b) => b.copiedAt.localeCompare(a.copiedAt)),
  };
}

/** Clears every content store. Preferences are kept. Rejects if any store cannot be cleared. */
export async function clearAllVaultDataInDB(): Promise<void> {
  for (const pending of pendingWrites.values()) {
    clearTimeout(pending.timer);
  }
  pendingWrites.clear();
  await Promise.all(inFlightWrites);
  await Promise.all([
    replaceAllInStore(STORES.promptFolders, []),
    replaceAllInStore(STORES.prompts, []),
    replaceAllInStore(STORES.stacks, []),
    replaceAllInStore(STORES.lessons, []),
    replaceAllInStore(STORES.markdownDocs, []),
    replaceAllInStore(STORES.clipboardHistory, []),
  ]);
  writeErrors.clear();
  emitStatus();
}

export function savePromptFoldersToDB(folders: PromptFolder[]): void {
  scheduleDebouncedStoreWrite(STORES.promptFolders, folders, 60);
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

export function saveThemePreferencesToDB(preferences: ThemePreferences): void {
  scheduleDebouncedStoreWrite(STORES.preferences, [{ id: "theme", value: preferences }], 60);
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

export function escapeXmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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

  if (format === "xml") {
    // Attribute values are escaped so titles such as `A <B> & "C"` still produce well-formed XML.
    // The body is left verbatim on purpose: prompts routinely contain their own XML-style tags.
    const tagsAttr = prompt.tags?.length
      ? ` tags="${escapeXmlAttribute(prompt.tags.join(","))}"`
      : "";
    return `<prompt title="${escapeXmlAttribute(prompt.title)}" category="${escapeXmlAttribute(prompt.category)}" target_agent="${escapeXmlAttribute(prompt.targetAgent)}"${tagsAttr}>\n${resolved.trim()}\n</prompt>`;
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

export function createVaultBackupBundle(state: {
  promptFolders: PromptFolder[];
  prompts: PromptItem[];
  stacks: TechStackItem[];
  lessons: CodeLessonItem[];
  markdownDocs: MarkdownDocItem[];
  preferences: ThemePreferences;
}): VaultBackupBundle {
  return {
    version: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    promptFolders: state.promptFolders,
    prompts: state.prompts,
    stacks: state.stacks,
    lessons: state.lessons,
    markdownDocs: state.markdownDocs,
    preferences: state.preferences,
  };
}
