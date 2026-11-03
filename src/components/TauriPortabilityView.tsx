import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowCounterClockwise,
  BracketsCurly,
  Check,
  Copy,
  Database,
  DownloadSimple,
  GitBranch,
  HardDrive,
  Laptop,
  Sliders,
  TerminalWindow,
  UploadSimple,
} from "./icons";
import {
  CodeLessonItem,
  MarkdownDocItem,
  PromptItem,
  TechStackItem,
  ThemePreferences,
  VaultBackupBundle,
} from "../types/vault";
import { createVaultBackupBundle, downloadTextFile } from "../services/vaultStorage";

// Lazy-load raw application source files on-demand when the Portability view mounts
const RAW_SOURCE_LOADERS = import.meta.glob(
  [
    "/index.html",
    "/package.json",
    "/tsconfig.json",
    "/vite.config.ts",
    "/metadata.json",
    "/src/**/*.ts",
    "/src/**/*.tsx",
    "/src/**/*.css",
  ],
  { query: "?raw", import: "default" },
) as Record<string, () => Promise<string>>;

interface TauriPortabilityViewProps {
  prompts: PromptItem[];
  stacks: TechStackItem[];
  lessons: CodeLessonItem[];
  markdownDocs: MarkdownDocItem[];
  preferences: ThemePreferences;
  onImportBundle: (bundle: VaultBackupBundle) => void;
  onResetToDefaults: () => void;
  onRecordClipboard?: (label: string, payload: string, kind: "config") => void;
  onNotify: (message: string) => void;
}

export const TauriPortabilityView: React.FC<TauriPortabilityViewProps> = ({
  prompts,
  stacks,
  lessons,
  markdownDocs,
  preferences,
  onImportBundle,
  onResetToDefaults,
  onRecordClipboard,
  onNotify,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [targetInstallDir, setTargetInstallDir] = useState("~/dev/forge-vault");
  const [rawSourceFiles, setRawSourceFiles] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    const entries = Object.entries(RAW_SOURCE_LOADERS);
    Promise.all(
      entries.map(async ([path, loader]) => {
        const content = await loader();
        return [path, content] as const;
      }),
    ).then((loaded) => {
      if (!mounted) return;
      const map: Record<string, string> = {};
      for (const [k, v] of loaded) {
        map[k] = v;
      }
      setRawSourceFiles(map);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Interactive Tauri v2 macOS App Configurator state
  const [productName, setProductName] = useState("ForgeVault");
  const [appIdentifier, setAppIdentifier] = useState("com.forgevault.studio");
  const [titleBarStyle, setTitleBarStyle] = useState<"Overlay" | "Transparent" | "Visible">(
    "Overlay",
  );
  const [windowWidth, setWindowWidth] = useState(1440);
  const [windowHeight, setWindowHeight] = useState(900);
  const [minMacOS, setMinMacOS] = useState("13.0");

  const dynamicTauriConfigJson = useMemo(() => {
    return JSON.stringify(
      {
        $schema: "https://schema.tauri.app/config/2",
        productName,
        version: "2.12.4",
        identifier: appIdentifier,
        build: {
          beforeDevCommand: "pnpm dev",
          devUrl: "http://localhost:3000",
          beforeBuildCommand: "pnpm build",
          frontendDist: "../dist",
        },
        app: {
          macOSPrivateApi: true,
          windows: [
            {
              title: `${productName} — AI Prompt, Stack & Monaco Studio`,
              width: Number(windowWidth) || 1440,
              height: Number(windowHeight) || 900,
              minWidth: 1024,
              minHeight: 680,
              titleBarStyle,
              hiddenTitle: titleBarStyle !== "Visible",
            },
          ],
          security: {
            csp: null,
          },
        },
        bundle: {
          active: true,
          targets: ["dmg", "app"],
          macOS: {
            minimumSystemVersion: minMacOS,
          },
        },
      },
      null,
      2,
    );
  }, [productName, appIdentifier, titleBarStyle, windowWidth, windowHeight, minMacOS]);

  const dynamicCargoToml = useMemo(() => {
    const crateSlug = productName.toLowerCase().replace(/[^a-z0-9]+/g, "_") || "forgevault";
    return `[package]
name = "${crateSlug}_desktop"
version = "2.12.4"
description = "${productName} macOS Native Tauri v2 Container"
edition = "2024"

[lib]
name = "${crateSlug}_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2.12.4", features = [] }

[dependencies]
tauri = { version = "2.12.4", features = ["macos-private-api"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

[profile.release]
panic = "abort"
codegen-units = 1
lto = true
opt-level = "s"
strip = true`;
  }, [productName]);

  const bundle = createVaultBackupBundle({
    prompts,
    stacks,
    lessons,
    markdownDocs,
    preferences,
  });

  const bundleJsonString = JSON.stringify(bundle, null, 2);
  const byteSize = new TextEncoder().encode(bundleJsonString).length;
  const kbSize = (byteSize / 1024).toFixed(1);

  const totalMonacoFiles = lessons.reduce((acc, l) => acc + l.files.length, 0);
  const sourceFileCount = Object.keys(RAW_SOURCE_LOADERS).length + 4; // + Tauri & snapshot files

  const [gitRepoUrl, setGitRepoUrl] = useState("https://github.com/will-drums/forge-vault.git");

  // Build self-extracting shell script that writes the entire project into ~/dev/forge-vault and pushes to GitHub
  const buildSelfExtractingInstallerScript = () => {
    const targetDir = targetInstallDir.trim() || "~/dev/forge-vault";
    const remoteUrl = gitRepoUrl.trim() || "https://github.com/will-drums/forge-vault.git";
    const lines: string[] = [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "",
      `# ForgeVault Full Application, Tauri v2 & GitHub Sync Installer`,
      `# Generated: ${new Date().toISOString()}`,
      `TARGET_DIR="${targetDir}"`,
      `GIT_REMOTE="${remoteUrl}"`,
      "# Expand leading ~ to $HOME if present",
      'TARGET_DIR="${TARGET_DIR/#\\~/$HOME}"',
      "",
      'echo ">>> Creating ForgeVault project directory at: $TARGET_DIR"',
      'mkdir -p "$TARGET_DIR"',
      'cd "$TARGET_DIR"',
      "",
    ];

    const writeEncodedFile = (relPath: string, content: string) => {
      const cleanRel = relPath.replace(/^\/+/, "");
      const dirPart = cleanRel.includes("/") ? cleanRel.slice(0, cleanRel.lastIndexOf("/")) : "";
      // Base64 encode UTF-8 safely
      const bytes = new TextEncoder().encode(content);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const b64 = btoa(binary);

      if (dirPart) {
        lines.push(`mkdir -p "${dirPart}"`);
      }
      lines.push(`cat << 'EOF_B64' | base64 --decode > "${cleanRel}"`);
      lines.push(b64);
      lines.push("EOF_B64");
      lines.push("");
    };

    for (const [filePath, rawContent] of Object.entries(rawSourceFiles)) {
      if (typeof rawContent === "string") {
        writeEncodedFile(filePath, rawContent);
      }
    }

    // Also include Tauri v2 desktop scaffold files + current Vault snapshot
    writeEncodedFile("src-tauri/tauri.conf.json", dynamicTauriConfigJson);
    writeEncodedFile("src-tauri/Cargo.toml", dynamicCargoToml);
    writeEncodedFile(
      "src-tauri/src/main.rs",
      `// Prevents additional console window on Windows in release, DO NOT REMOVE!!\n#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]\n\nfn main() {\n  tauri::Builder::default()\n    .run(tauri::generate_context!())\n    .expect("error while running ForgeVault Tauri application");\n}\n`,
    );
    writeEncodedFile("forgevault-workspace-backup.json", bundleJsonString);

    lines.push('echo ">>> Initializing Git repository & committing to $GIT_REMOTE..."');
    lines.push('if [ ! -d ".git" ]; then');
    lines.push("  git init -b main");
    lines.push("fi");
    lines.push("git remote remove origin 2>/dev/null || true");
    lines.push('git remote add origin "$GIT_REMOTE"');
    lines.push("git add -A");
    lines.push(
      'git commit -m "feat: ForgeVault Studio (Prompts, Stacks, Monaco Split Studio, Duplicate Detection & Bulk Export)" || true',
    );
    lines.push("git push -u origin main");
    lines.push('echo ">>> Installing dependencies with pnpm (Node 26 LTS)..."');
    lines.push("pnpm install");
    lines.push('echo ""');
    lines.push('echo "✅ ForgeVault pushed to $GIT_REMOTE and installed in $TARGET_DIR"');
    lines.push('echo "   Run Web Studio:    cd \\"$TARGET_DIR\\" && pnpm dev"');
    lines.push('echo "   Run macOS Tauri:   cd \\"$TARGET_DIR\\" && pnpm dlx @tauri-apps/cli dev"');

    return lines.join("\n");
  };

  const handleDownloadInstallerScript = () => {
    const script = buildSelfExtractingInstallerScript();
    downloadTextFile("install-forge-vault.sh", script, "application/x-sh;charset=utf-8");
    onNotify(
      `Downloaded install-forge-vault.sh (${sourceFileCount} files + git push to ${gitRepoUrl})`,
    );
  };

  const handleExportJson = () => {
    const dateStamp = new Date().toISOString().slice(0, 10);
    downloadTextFile(
      `forgevault-workspace-${dateStamp}.json`,
      bundleJsonString,
      "application/json;charset=utf-8",
    );
    onNotify("Exported complete IndexedDB workspace bundle (.json)");
  };

  const handleExportMarkdownArchive = () => {
    const dateStamp = new Date().toISOString().slice(0, 10);
    const promptSection = prompts
      .map(
        (p) =>
          `## ${p.title}\n- Category: ${p.category} · Target Agent: ${p.targetAgent}\n\n\`\`\`text\n${p.content}\n\`\`\``,
      )
      .join("\n\n");

    const stackSection = stacks
      .map((s) => `## ${s.name}\n${s.tagline}\n\n\`\`\`xml\n${s.agentContextBlock}\n\`\`\``)
      .join("\n\n");

    const lessonSection = lessons
      .map(
        (l) =>
          `## ${l.title}\n\n${l.markdownNotes}\n\n${l.files
            .map((f) => `### File: \`${f.filename}\`\n\`\`\`${f.language}\n${f.content}\n\`\`\``)
            .join("\n\n")}`,
      )
      .join("\n\n---\n\n");

    const fullArchive = `# ForgeVault Complete Markdown Archive (${dateStamp})\n\n# Part 1: Prompt Library\n\n${promptSection}\n\n---\n\n# Part 2: Tech Stack Vault\n\n${stackSection}\n\n---\n\n# Part 3: Code Lessons & Monaco Files\n\n${lessonSection}\n`;

    downloadTextFile(`forgevault-handbook-${dateStamp}.md`, fullArchive);
    onNotify("Exported full Markdown handbook (.md)");
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as VaultBackupBundle;
        if (!Array.isArray(parsed.prompts) || !Array.isArray(parsed.stacks)) {
          onNotify("Invalid ForgeVault JSON backup file structure");
          return;
        }
        onImportBundle(parsed);
        onNotify(
          `Restored ${parsed.prompts.length} prompts, ${parsed.stacks.length} stacks, and ${
            parsed.lessons?.length || 0
          } lessons!`,
        );
      } catch {
        onNotify("Failed to parse JSON bundle file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleCopyConfig = async (key: string, text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      onRecordClipboard?.(label, text, "config");
      onNotify(`Copied ${label} to clipboard`);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      onNotify("Clipboard copy failed");
    }
  };

  const oneLineInstallCmd = `bash ~/Downloads/install-forge-vault.sh`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-5 border-b border-(--md-sys-color-outline-variant)">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Local-First Storage & macOS Tauri v2 Portability
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Push and clone the complete ForgeVault source code to{" "}
          <code className="font-mono">https://github.com/will-drums/forge-vault.git</code>, install
          into <code className="font-mono">~/dev/forge-vault</code>, or export portable
          JSON/Markdown snapshots.
        </p>
      </div>

      {/* GitHub Commit/Push & Local ~/dev/forge-vault Installer Card */}
      <div className="p-6 m3-card border-2 border-indigo-500/40 dark:border-indigo-500/40 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1">
              <GitBranch className="w-4 h-4" />
              <span>
                GitHub Repository Sync + Full Tauri v2 Source ({sourceFileCount} files bundled)
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Commit & Push to <code className="font-mono">{gitRepoUrl}</code>
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              All project files and <code className="font-mono">src-tauri</code> configurations are
              committed on <code className="font-mono">main</code>. Download the self-extracting
              GitHub push script below to unpack into{" "}
              <code className="font-mono">{targetInstallDir}</code> and push straight to your GitHub
              repo using your local macOS credentials.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <a
              href="/forge-vault.tar.gz"
              download="forge-vault.tar.gz"
              onClick={() => onNotify("Downloading forge-vault.tar.gz full project archive")}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium bg-(--md-sys-color-surface-container-high) text-slate-800 dark:text-slate-200 hover:bg-(--md-sys-color-surface-container-highest) transition-colors cursor-pointer"
            >
              <DownloadSimple className="w-3.5 h-3.5" />
              <span>Download forge-vault.tar.gz</span>
            </a>

            <button
              type="button"
              onClick={handleDownloadInstallerScript}
              style={{ backgroundColor: preferences.accentHex }}
              className="flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold text-white shadow-xs hover:opacity-95 transition-opacity cursor-pointer"
            >
              <TerminalWindow className="w-3.5 h-3.5" />
              <span>Download GitHub Push & Setup Script</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-3 border-t border-(--md-sys-color-outline-variant) items-end">
          <div className="lg:col-span-5">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              GitHub Remote Repository URL
            </label>
            <input
              type="text"
              value={gitRepoUrl}
              onChange={(e) => setGitRepoUrl(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-mono rounded-lg bg-(--md-sys-color-surface-container-low) border border-(--md-sys-color-outline-variant) text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="lg:col-span-3">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Local Clone / Target Directory
            </label>
            <input
              type="text"
              value={targetInstallDir}
              onChange={(e) => setTargetInstallDir(e.target.value)}
              placeholder="~/dev/forge-vault"
              className="w-full px-3 py-1.5 text-xs font-mono rounded-lg bg-(--md-sys-color-surface-container-low) border border-(--md-sys-color-outline-variant) text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="lg:col-span-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Execute in macOS Terminal:
              </span>
              <button
                type="button"
                onClick={() =>
                  handleCopyConfig(
                    "install-cmd",
                    oneLineInstallCmd,
                    "Terminal Install & Push Command",
                  )
                }
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                {copiedKey === "install-cmd" ? "Copied!" : "Copy Command"}
              </button>
            </div>
            <pre className="px-3.5 py-1.5 rounded-lg bg-slate-950 text-slate-200 font-mono text-xs border border-slate-800 overflow-x-auto">
              <code>{oneLineInstallCmd}</code>
            </pre>
          </div>
        </div>
      </div>

      {/* Storage Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 m3-card">
          <div className="text-xs text-slate-500 dark:text-slate-400">Saved Prompts</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {prompts.length}
          </div>
        </div>
        <div className="p-4 m3-card">
          <div className="text-xs text-slate-500 dark:text-slate-400">Tech Stacks</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {stacks.length}
          </div>
        </div>
        <div className="p-4 m3-card">
          <div className="text-xs text-slate-500 dark:text-slate-400">Code Lessons & Tabs</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {lessons.length}{" "}
            <span className="text-xs font-normal text-slate-400">({totalMonacoFiles} files)</span>
          </div>
        </div>
        <div className="p-4 m3-card">
          <div className="text-xs text-slate-500 dark:text-slate-400">Markdown (.md) Docs</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {markdownDocs.length}
          </div>
        </div>
        <div className="p-4 m3-card">
          <div className="text-xs text-slate-500 dark:text-slate-400">IndexedDB Snapshot Size</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400 mt-1">
            {kbSize} KB
          </div>
        </div>
      </div>

      {/* Portable Backup & Restore Card */}
      <div className="p-6 m3-card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Database className="w-3.5 h-3.5 text-indigo-500" />
              <span>Engine: IndexedDB (forgevault_idb_v2)</span>
              <span aria-hidden="true">·</span>
              <span>Zero external cloud dependencies</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Workspace Snapshot Import & Export
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              Move your entire vault between your browser and your macOS Tauri desktop app in one
              click.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportJsonFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium bg-(--md-sys-color-surface-container-high) text-slate-800 dark:text-slate-200 hover:bg-(--md-sys-color-surface-container-highest) transition-colors cursor-pointer"
            >
              <UploadSimple className="w-3.5 h-3.5" />
              <span>Import JSON Snapshot</span>
            </button>

            <button
              type="button"
              onClick={handleExportMarkdownArchive}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium bg-(--md-sys-color-surface-container-high) text-slate-800 dark:text-slate-200 hover:bg-(--md-sys-color-surface-container-highest) transition-colors cursor-pointer"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Export All as .md Handbook</span>
            </button>

            <button
              type="button"
              onClick={handleExportJson}
              style={{ backgroundColor: preferences.accentHex }}
              className="flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold text-white shadow-xs hover:opacity-95 transition-opacity cursor-pointer"
            >
              <BracketsCurly className="w-3.5 h-3.5" />
              <span>Export Full Vault (.json)</span>
            </button>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-(--md-sys-color-outline-variant) flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Want to wipe all prompts, tech stacks, lessons, and Markdown docs from IndexedDB?
          </span>
          {confirmReset ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-rose-500 font-medium">
                Confirm clearing all vault data?
              </span>
              <button
                type="button"
                onClick={() => {
                  onResetToDefaults();
                  setConfirmReset(false);
                }}
                className="px-3.5 py-1 text-xs font-semibold rounded-full bg-rose-600 text-white cursor-pointer"
              >
                Yes, Clear Vault
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-3.5 py-1 text-xs rounded-full border border-(--md-sys-color-outline-variant) text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-rose-500 transition-colors cursor-pointer"
            >
              <ArrowCounterClockwise className="w-3.5 h-3.5" />
              <span>Clear All Vault Data</span>
            </button>
          )}
        </div>
      </div>

      {/* Interactive Tauri v2 macOS Bundle Configurator */}
      <div className="p-6 m3-card space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-semibold mb-1">
              <Sliders className="w-3.5 h-3.5" />
              <span>Interactive macOS Tauri v2 Build Configurator</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Customize Native macOS Desktop Bundle Settings
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              macOS App Name
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-mono rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Bundle Identifier
            </label>
            <input
              type="text"
              value={appIdentifier}
              onChange={(e) => setAppIdentifier(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-mono rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              macOS TitleBar Style
            </label>
            <select
              value={titleBarStyle}
              onChange={(e) =>
                setTitleBarStyle(e.target.value as "Overlay" | "Transparent" | "Visible")
              }
              className="w-full px-3 py-1.5 text-xs font-mono rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value="Overlay">Overlay (Traffic Lights Integrated)</option>
              <option value="Transparent">Transparent</option>
              <option value="Visible">Standard Visible</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Default Viewport (W × H)
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={windowWidth}
                onChange={(e) => setWindowWidth(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
              />
              <span className="text-xs text-slate-400">×</span>
              <input
                type="number"
                value={windowHeight}
                onChange={(e) => setWindowHeight(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Min macOS Target
            </label>
            <select
              value={minMacOS}
              onChange={(e) => setMinMacOS(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-mono rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value="13.0">macOS 13.0 (Ventura+)</option>
              <option value="14.0">macOS 14.0 (Sonoma+)</option>
              <option value="15.0">macOS 15.0 (Sequoia+)</option>
            </select>
          </div>
        </div>

        {/* Generated Config Files */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          <div className="flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <Laptop className="w-4 h-4 text-indigo-500" />
                <span>src-tauri/tauri.conf.json</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    downloadTextFile("tauri.conf.json", dynamicTauriConfigJson, "application/json")
                  }
                  className="p-1.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  title="Download tauri.conf.json"
                >
                  <DownloadSimple className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyConfig("tauri-conf", dynamicTauriConfigJson, "tauri.conf.json")
                  }
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {copiedKey === "tauri-conf" ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Config</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            <pre className="p-4 rounded-lg bg-slate-950 text-slate-200 font-mono text-xs leading-relaxed overflow-x-auto border border-slate-800 max-h-80">
              <code>{dynamicTauriConfigJson}</code>
            </pre>
          </div>

          <div className="flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <Laptop className="w-4 h-4 text-indigo-500" />
                <span>src-tauri/Cargo.toml</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadTextFile("Cargo.toml", dynamicCargoToml, "text/plain")}
                  className="p-1.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  title="Download Cargo.toml"
                >
                  <DownloadSimple className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyConfig("cargo-toml", dynamicCargoToml, "Cargo.toml")}
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {copiedKey === "cargo-toml" ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Cargo.toml</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            <pre className="p-4 rounded-lg bg-slate-950 text-slate-200 font-mono text-xs leading-relaxed overflow-x-auto border border-slate-800 max-h-80">
              <code>{dynamicCargoToml}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
