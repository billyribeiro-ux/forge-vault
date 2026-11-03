# ForgeVault — AI Prompt, Tech Stack & Monaco Code Studio

A local-first web and macOS Tauri v2 desktop studio for curating parameterized AI prompts, canonical tech stack blueprints (with one-click copy for Argon and other coding agents), split-pane Markdown + multi-file Monaco Editor code lessons, and standalone `.md` documents.

## Quick Start (Web Studio)

```bash
# Clone into ~/dev/forge-vault
mkdir -p ~/dev
cd ~/dev
git clone https://github.com/will-drums/forge-vault.git
cd forge-vault

# Install dependencies (Vite+ uses the pnpm version pinned in package.json)
vp install

# Start the development server on http://localhost:3000
vp dev --port=3000   # or: vp run dev
```

## Production Build

```bash
vp check   # lint + format + type-check
vp build
vp preview
```

## macOS Desktop Build (Tauri v2)

Uses the `dev`/`build` package scripts (via Vite+). Requires Rust (`rustup`) installed on macOS:

```bash
# Run native macOS window in dev mode
pnpm dlx @tauri-apps/cli@latest dev

# Build native macOS .app and .dmg bundle
pnpm dlx @tauri-apps/cli@latest build
```

## Core Features

- **Prompt Library**: Parameterized `{{variable}}` templates, version history rollback, custom `#tag` filtering, duplicate detection (with Merge/Skip), and one-click copy in Raw, Agent XML, Markdown, or System JSON format.
- **Tech Stack Vault**: Dependency version matrices, architectural conventions, `package.json` / `Cargo.toml` manifest generators, duplicate detection, and multi-stack bulk export to consolidated `.md` or `.json` bundles.
- **Code Lessons (Monaco Split Studio)**: Resizable split-pane workspace pairing rich Markdown notes with a multi-file Monaco Editor.
- **Markdown Vault**: Dedicated `.md` document studio with live side-by-side preview and import/export.
- **Local-First IndexedDB (`forgevault_idb_v1`)**: Full workspace persistence with JSON and Markdown snapshot backup/restore.
