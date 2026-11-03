import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { PromptItem } from "../../types/vault";

function makePrompt(overrides: Partial<PromptItem> = {}): PromptItem {
  return {
    id: "p1",
    title: "Title",
    category: "Architecture",
    targetAgent: "Claude",
    tags: [],
    description: "",
    content: "Body",
    variables: [],
    isFavorite: false,
    copyCount: 0,
    updatedAt: "2026-11-03T00:00:00.000Z",
    ...overrides,
  };
}

// A fresh in-memory IndexedDB and a fresh module instance per test, so the cached connection and
// the pending-write queue never leak between tests.
async function freshStorage() {
  globalThis.indexedDB = new IDBFactory();
  vi.resetModules();
  return import("../vaultStorage");
}

describe("formatPromptPayload", () => {
  let storage: typeof import("../vaultStorage");
  beforeEach(async () => {
    storage = await freshStorage();
  });

  it("substitutes variables literally, including $& and $1 sequences", () => {
    const prompt = makePrompt({
      content: "Use {{v}} and {{ v }} then {{w}}",
      variables: [
        { name: "v", defaultValue: "$& $1" },
        { name: "w", defaultValue: "default-w" },
      ],
    });
    expect(storage.formatPromptPayload(prompt, "raw", { w: "W" })).toBe(
      "Use $& $1 and $& $1 then W",
    );
  });

  it("produces well-formed XML when the title contains markup characters", () => {
    const prompt = makePrompt({
      title: `A <B> & "C"`,
      tags: ["x&y"],
      content: "<context>keep</context>",
    });
    const xml = storage.formatPromptPayload(prompt, "xml");
    expect(xml).toContain('title="A &lt;B&gt; &amp; &quot;C&quot;"');
    expect(xml).toContain('tags="x&amp;y"');
    // The body keeps its own tags verbatim.
    expect(xml).toContain("<context>keep</context>");
  });

  it("emits parseable JSON", () => {
    const parsed = JSON.parse(storage.formatPromptPayload(makePrompt({ title: 'q"t' }), "json"));
    expect(parsed.title).toBe('q"t');
    expect(parsed.content).toBe("Body");
  });
});

describe("extractTemplateVariables / normalizeTagLabel", () => {
  it("keeps existing defaults and drops removed variables", async () => {
    const storage = await freshStorage();
    const vars = storage.extractTemplateVariables("{{a}} {{ b }} {{a}}", [
      { name: "a", defaultValue: "kept" },
      { name: "gone", defaultValue: "x" },
    ]);
    expect(vars).toEqual([
      { name: "a", defaultValue: "kept", description: undefined },
      { name: "b", defaultValue: "[b]", description: undefined },
    ]);
    expect(storage.normalizeTagLabel("  ##My Tag!! ")).toBe("my-tag");
  });
});

describe("IndexedDB persistence", () => {
  it("round-trips prompts and folders through flushPendingWrites", async () => {
    const storage = await freshStorage();
    const initial = await storage.loadInitialVaultState();
    expect(initial.prompts).toEqual([]);

    storage.savePromptFoldersToDB([{ id: "folder-1", name: "Frontend", createdAt: "x" }]);
    storage.savePromptsToDB([makePrompt({ folderId: "folder-1" })]);
    expect(storage.hasPendingWrites()).toBe(true);
    await storage.flushPendingWrites();
    expect(storage.hasPendingWrites()).toBe(false);

    const loaded = await storage.loadInitialVaultState();
    expect(loaded.promptFolders.map((f) => f.name)).toEqual(["Frontend"]);
    expect(loaded.prompts[0].folderId).toBe("folder-1");
  });

  it("files prompts whose folder no longer exists as Unfiled on load", async () => {
    const storage = await freshStorage();
    await storage.loadInitialVaultState();
    storage.savePromptsToDB([makePrompt({ folderId: "folder-missing" })]);
    await storage.flushPendingWrites();
    const loaded = await storage.loadInitialVaultState();
    expect(loaded.prompts[0].folderId).toBeNull();
  });

  it("coalesces debounced writes so only the latest state is stored", async () => {
    const storage = await freshStorage();
    await storage.loadInitialVaultState();
    storage.saveLessonsToDB([]);
    storage.savePromptsToDB([makePrompt({ id: "a" })]);
    storage.savePromptsToDB([makePrompt({ id: "b" })]);
    await storage.flushPendingWrites();
    const loaded = await storage.loadInitialVaultState();
    expect(loaded.prompts.map((p) => p.id)).toEqual(["b"]);
  });

  it("upgrades a v2 database to v3 without losing data and leaves the v1 database alone", async () => {
    globalThis.indexedDB = new IDBFactory();
    const open = (name: string, version: number, upgrade: (db: IDBDatabase) => void) =>
      new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(name, version);
        req.onupgradeneeded = () => upgrade(req.result);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    const v1 = await open("forgevault_idb_v1", 1, (db) => db.createObjectStore("legacy"));
    v1.close();
    const v2 = await open("forgevault_idb_v2", 2, (db) => {
      for (const s of [
        "prompts",
        "stacks",
        "lessons",
        "markdownDocs",
        "preferences",
        "clipboardHistory",
      ]) {
        db.createObjectStore(s, { keyPath: "id" });
      }
    });
    await new Promise<void>((resolve) => {
      const tx = v2.transaction("prompts", "readwrite");
      tx.objectStore("prompts").put(makePrompt({ id: "old" }));
      tx.oncomplete = () => resolve();
    });
    v2.close();

    vi.resetModules();
    const storage = await import("../vaultStorage");
    const loaded = await storage.loadInitialVaultState();
    expect(loaded.prompts.map((p) => p.id)).toEqual(["old"]);
    expect(loaded.promptFolders).toEqual([]);
    const names = (await indexedDB.databases()).map((d) => d.name);
    expect(names).toContain("forgevault_idb_v1");
  });

  it("rejects instead of returning an empty vault when storage cannot be opened", async () => {
    vi.resetModules();
    const storage = await import("../vaultStorage");
    const original = globalThis.indexedDB;
    // @ts-expect-error simulate an environment without IndexedDB
    delete globalThis.indexedDB;
    try {
      await expect(storage.loadInitialVaultState()).rejects.toThrow(/IndexedDB is not available/);
    } finally {
      globalThis.indexedDB = original;
    }
  });
});
