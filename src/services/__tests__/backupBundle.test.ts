import { describe, expect, it } from "vite-plus/test";
import { describeBackupCounts, parseVaultBackup } from "../backupBundle";

describe("parseVaultBackup", () => {
  it("rejects text that is not JSON", () => {
    const result = parseVaultBackup("{nope");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not valid JSON/);
  });

  it("rejects objects without any ForgeVault collection", () => {
    expect(parseVaultBackup('{"hello":1}')).toEqual({
      ok: false,
      error: "The file contains no ForgeVault collections",
    });
  });

  it("names the first invalid field", () => {
    const result = parseVaultBackup(JSON.stringify({ prompts: [{ id: "a", title: "t" }] }));
    expect(result).toEqual({ ok: false, error: "prompts[0].content must be text" });
  });

  it("rejects duplicate ids", () => {
    const p = { id: "a", title: "t", content: "c" };
    const result = parseVaultBackup(JSON.stringify({ prompts: [p, p] }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/appears twice/);
  });

  it("fills safe defaults and keeps absent collections undefined", () => {
    const result = parseVaultBackup(
      JSON.stringify({
        promptFolders: [{ id: "folder-1", name: " Frontend " }],
        prompts: [
          { id: "a", title: "t", content: "c", folderId: "folder-1" },
          { id: "b", title: "t2", content: "c2", folderId: "folder-unknown" },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { backup } = result;
    expect(backup.stacks).toBeUndefined();
    expect(backup.promptFolders?.[0].name).toBe("Frontend");
    expect(backup.prompts?.[0]).toMatchObject({ tags: [], variables: [], folderId: "folder-1" });
    expect(backup.prompts?.[1].folderId).toBeNull();
    expect(describeBackupCounts(backup)).toBe("1 folder, 2 prompts");
  });

  it("accepts a backup produced by the current exporter", () => {
    const bundle = {
      version: "2026.10.31",
      exportedAt: "2026-11-03T00:00:00.000Z",
      promptFolders: [],
      prompts: [],
      stacks: [],
      lessons: [{ id: "l", title: "L", files: [{ id: "f", filename: "a.ts", content: "x" }] }],
      markdownDocs: [{ id: "d", filename: "a.md", content: "# A" }],
      preferences: { mode: "light" },
    };
    const result = parseVaultBackup(JSON.stringify(bundle));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.backup.lessons?.[0].activeFileId).toBe("f");
      expect(result.backup.preferences?.mode).toBe("light");
      expect(result.backup.preferences?.editorFontSize).toBe(13);
    }
  });
});
