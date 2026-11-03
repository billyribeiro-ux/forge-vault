# ForgeVault — agent guide

Read this before changing anything in this repo. It is the source of truth for how to build, check, and upgrade the project. Facts below were verified on 2026-11-03.

## What this repo is

- ForgeVault is a local-first web studio (React 19, Vite+, Tailwind v4) plus a macOS Tauri v2 shell in `src-tauri/`.
- Persistence is IndexedDB (`forgevault_idb_v1`), with JSON and Markdown backup/restore.
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

| Task                      | Command                                      | Notes                                                                        |
| ------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------- |
| Install deps              | `pnpm exec vp install`                       | Reports "Already up to date" when the lock matches.                          |
| Dev server                | `pnpm exec vp dev` or `pnpm exec vp run dev` | Port 3000, host 0.0.0.0 (from the `dev` script).                             |
| Lint + format + typecheck | `pnpm exec vp check`                         | Gate for every change. Baseline: 0 errors, 10 warnings.                      |
| Typecheck only            | `pnpm run lint`                              | Runs `tsc --noEmit`.                                                         |
| Tests                     | `pnpm exec vp test`                          | **Currently exits 1** with "No test files found". The repo has no tests yet. |
| Production build          | `pnpm exec vp build`                         | Output goes to `dist/` (gitignored).                                         |
| Preview build             | `pnpm exec vp preview`                       |                                                                              |

### Do not

- Do not install the global `vp` with the `curl -fsSL https://vite.plus | bash` vendor script. Use `pnpm exec vp` or `pnpm dlx --package=vite-plus@<version> vp`.
- Do not run `vp migrate --full` unless the maintainer asks. It adds git hooks, editor files, agent files, and lint/format migrations.
- Do not run migrations with `node_modules/.bin/vp` from the old version. Use a `pnpm dlx --package=vite-plus@<target>` invocation.
- Do not add a test config that silences `vp test`'s exit code without asking.

## Upgrading Vite+

1. Find the latest stable: `pnpm view vite-plus dist-tags` (the `latest` tag is the stable release).
2. Set `vite-plus` and the `vite` catalog entry (`npm:@voidzero-dev/vite-plus-core@<same version>`) in `pnpm-workspace.yaml`. Both must match.
3. Run `pnpm install`.
4. From the repo root: `pnpm dlx --package=vite-plus@<version> vp help migrate`, then `pnpm dlx --package=vite-plus@<version> vp migrate --no-interactive`. Review `git diff` after it runs.
5. Validate: `pnpm exec vp install`, `pnpm exec vp check`, `pnpm exec vp test` (expected to exit 1 until tests exist), `pnpm exec vp build`.
6. Commit only when asked. Work on a branch, because `main` is the default branch.

Result on 2026-11-03: the pinned 1.4.0 migrator printed "This project is already using Vite+! Happy coding!" and changed no files. The project was already at the latest stable version.

## Project layout

- `src/App.tsx`: the main application shell.
- `src/components/`: views and modals (`PromptsView`, `StacksView`, `LessonsSplitStudio`, `MarkdownVaultView`, `TauriPortabilityView`, `CommandPaletteModal`, `ThemeCustomizerModal`, `ClipboardHistoryDrawer`, `MarkdownRenderer`, `icons`).
- `src/services/`: `vaultStorage.ts` (IndexedDB), `duplicateDetector.ts`, `sandboxRunner.ts`, `monacoTheme.ts`.
- `src/types/vault.ts`: shared domain types. `src/data/seedVault.ts`: seed data. `src/index.css`: global styles.
- `vite.config.ts`: the single Vite+ config. Contains the `lint` block (oxlint with type-aware checks), the `fmt` block, `lazyPlugins(react, tailwindcss)`, the `@` alias to the repo root, and `manualChunks` for `react-vendor` and `monaco-vendor`.
- `src-tauri/tauri.conf.json`: `beforeDevCommand` is `pnpm run dev` and `beforeBuildCommand` is `pnpm run build`. Both run the `vp` scripts.

## Rules for changes

- **Do not modify the `server` block in `vite.config.ts`.** It controls HMR and file watching through `DISABLE_HMR`. The file comment says not to change it, because watching is disabled during agent edits.
- **Do not add `vp check` warnings.** The baseline is 10 warnings: 6 `typescript(no-floating-promises)`, 2 `eslint(no-useless-escape)`, and 1 `typescript(no-base-to-string)`, spread across `src/App.tsx`, `src/services/sandboxRunner.ts`, `src/components/TauriPortabilityView.tsx`, and `src/components/CommandPaletteModal.tsx`. If you touch a floating promise, `await` it or mark it `void` with a comment saying why.
- **Honest data only.** Do not fabricate seed or demo data to make a screen look full. Show an explicit empty state.
- **Environment files.** `.env*` is gitignored except `.env.example`. Never commit real secrets.
- **Commits and pushes.** Commit or push only when the maintainer asks. Branch off `main` first.

## Pre-push checklist

1. `pnpm exec vp check` passes with no new warnings.
2. `pnpm exec vp build` passes.
3. If you changed Rust, run `cargo clippy --all-targets -- -D warnings` in `src-tauri/`.
4. `pnpm exec vp test` is only expected to fail with "No test files found" until tests exist. Report that result as-is.
