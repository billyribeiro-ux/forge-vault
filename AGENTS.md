# ForgeVault — agent guide

Read this before changing anything in this repo. It is the source of truth for how to build, check, and upgrade the project. Facts below were verified on 2026-11-03.

## What this repo is

- ForgeVault is a local-first web studio (React 19, Vite+, Tailwind v4) plus a macOS Tauri v2 shell in `src-tauri/`.
- Persistence is IndexedDB database `forgevault_idb_v2` (schema version 3, which adds `promptFolders`), with validated JSON restore and JSON/Markdown export. The legacy `forgevault_idb_v1` database is no longer deleted on launch.
- It is **not** a SvelteKit project. There are no `.svelte` files. Do not apply SvelteKit or Svelte-MCP rules here.
- Rust exists only in `src-tauri/`. Use the normal `cargo` workflow there.

## Toolchain

| Item               | Value                                       | Where it is set                                       |
| ------------------ | ------------------------------------------- | ----------------------------------------------------- |
| Vite+              | `1.4.0` (latest stable on npm `latest` tag) | `pnpm-workspace.yaml` → `catalog.vite-plus`           |
| Vite core          | `npm:@voidzero-dev/vite-plus-core@1.4.0`    | `pnpm-workspace.yaml` → `catalog.vite`                |
| Package manager    | `pnpm@12.16.1`                              | `package.json` → `packageManager`                     |
| Node               | `26.13.0`                                   | `.nvmrc`, `.node-version`, `package.json` → `engines` |
| Lockfile of record | `pnpm-lock.yaml`                            | —                                                     |

- `bun.lock` is stale. Do not run `bun install` and do not update `bun.lock`. Removing it is an open decision for the maintainer.
- Versions are pinned in the pnpm catalog. Change them there, not per package.
- Bundled tools (from `pnpm exec vp toolchain`): vitest 5.0.5, oxlint 1.89.0, oxfmt 0.74.0, tsdown 0.23.1, vite 8.3.5, rolldown 1.2.15.

### Commands

Run project commands through the local CLI: `pnpm exec vp <command>`. Once `vp` is on PATH, `vp <command>` is equivalent.

| Task                      | Command                                      | Notes                                                                  |
| ------------------------- | -------------------------------------------- | ---------------------------------------------------------------------- |
| Install deps              | `pnpm exec vp install`                       | Reports "Already up to date" when the lock matches.                    |
| Dev server                | `pnpm exec vp dev` or `pnpm exec vp run dev` | Port 3000 with `--strictPort` (Tauri's `devUrl` is fixed to 3000).     |
| Lint + format + typecheck | `pnpm exec vp check src`                     | Gate for every change. Baseline: 0 errors, 0 warnings. See note below. |
| Typecheck only            | `pnpm run lint`                              | Runs `tsc --noEmit`.                                                   |
| Tests                     | `pnpm exec vp test`                          | Vitest unit tests in `src/**/__tests__` (storage, backup validation).  |
| Production build          | `pnpm exec vp build`                         | Output goes to `dist/` (gitignored).                                   |
| Preview build             | `pnpm exec vp preview`                       |                                                                        |

### Do not

- Do not install the global `vp` with the `curl -fsSL https://vite.plus | bash` vendor script. Use `pnpm exec vp` or `pnpm dlx --package=vite-plus@<version> vp`.
- Do not run `vp migrate --full` unless the maintainer asks. It adds git hooks, editor files, agent files, and lint/format migrations.
- Do not run migrations with `node_modules/.bin/vp` from the old version. Use a `pnpm dlx --package=vite-plus@<target>` invocation.
- Do not add a test config that silences `vp test`'s exit code without asking.
- Do not run `cargo tauri dev` against the real app's data. The installed app and a dev build share the identifier `com.forgevault.studio` and therefore the same WebKit IndexedDB. For destructive testing use an isolated identifier: `cargo tauri dev --config '{"identifier":"com.forgevault.studio.audit"}'`.

## Upgrading Vite+

1. Find the latest stable: `pnpm view vite-plus dist-tags` (the `latest` tag is the stable release).
2. Set `vite-plus` and the `vite` catalog entry (`npm:@voidzero-dev/vite-plus-core@<same version>`) in `pnpm-workspace.yaml`. Both must match.
3. Run `pnpm install`.
4. From the repo root: `pnpm dlx --package=vite-plus@<version> vp help migrate`, then `pnpm dlx --package=vite-plus@<version> vp migrate --no-interactive`. Review `git diff` after it runs.
5. Validate: `pnpm exec vp install`, `pnpm exec vp check src`, `pnpm exec vp test`, `pnpm exec vp build`.
6. Commit only when asked. Work on a branch, because `main` is the default branch.

Result on 2026-11-03: the pinned 1.4.0 migrator printed "This project is already using Vite+! Happy coding!" and changed no files. The project was already at the latest stable version.

## Project layout

- `src/App.tsx`: application shell. Owns all vault state, hydrates it from IndexedDB, and persists each collection through one effect per collection that only runs after a successful load.
- `src/components/`: views and dialogs: `PromptsView` (with `PromptFolderRail` and the lazy `PromptReader`), `StacksView`, `LessonsSplitStudio`, `MarkdownVaultView`, `DataBackupView`, `CommandPaletteModal`, `ThemeCustomizerModal`, `ClipboardHistoryDrawer`, `MarkdownRenderer`, `icons`, and the `useDialogFocus` hook used by modal dialogs.
- `src/services/`:
  - `vaultStorage.ts`: IndexedDB access, the write queue (`flushPendingWrites`, save status), and prompt formatting.
  - `backupBundle.ts`: validation of JSON backups before restore.
  - `fileExport.ts`: saving files (native save panel in Tauri, download in a browser).
  - `desktopShell.ts`: flush-on-hide/quit lifecycle and macOS shell detection.
  - `monacoSetup.ts`: bundles Monaco locally (no CDN). `ids.ts`, `duplicateDetector.ts`, `sandboxRunner.ts`, `monacoTheme.ts`.
- `src/types/vault.ts`: shared domain types. `src/data/seedVault.ts`: default preferences (no seed content).
- `vite.config.ts`: the single Vite+ config. Contains the `lint` block, the `fmt` block, `lazyPlugins(react, tailwindcss)`, the `@` alias, and `manualChunks` for `react-vendor`, `monaco-vendor`, and `monaco-editor`.
- `src-tauri/`: `src/lib.rs` registers `export_text_file` (native save panel + atomic write) and `confirm_exit` (quit waits for the webview to flush writes). `capabilities/default.json` grants only event listen/unlisten and window dragging. `tauri.conf.json` sets a CSP (`script-src 'self' 'unsafe-eval'`; the eval allowance is for the lesson code sandbox worker).
- `docs/audit/`: audit reports and coverage ledgers.

## Rules for changes

- **Do not modify the `server` block in `vite.config.ts`.** It controls HMR and file watching through `DISABLE_HMR`. The file comment says not to change it, because watching is disabled during agent edits.
- **Do not add `vp check` warnings.** The baseline is 0 warnings. Pass paths (`vp check src …`): a bare `vp check` also formats untracked files in the repo root.
- **Persistence.** Never write vault state before hydration succeeds. Schema changes bump `DB_VERSION` and only add stores in `onupgradeneeded`; never drop or rename a store or database.
- **Honest data only.** Do not fabricate seed or demo data to make a screen look full. Show an explicit empty state.
- **Environment files.** `.env*` is gitignored except `.env.example`. Never commit real secrets.
- **Commits and pushes.** Commit or push only when the maintainer asks. Branch off `main` first.

## Pre-push checklist

1. `pnpm exec vp check` passes with no new warnings.
2. `pnpm exec vp build` passes.
3. If you changed Rust, run `cargo clippy --all-targets -- -D warnings` in `src-tauri/`.
4. `pnpm exec vp test` passes.
5. If you changed Rust, also run `cargo test --lib` in `src-tauri/`.
