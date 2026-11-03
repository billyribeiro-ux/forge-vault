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

`vp test` runs the unit tests (storage, backup validation).

## Upgrading Vite+

The toolchain is Vite+ 1.4.0 (latest stable), pinned in `pnpm-workspace.yaml`. Upgrade steps and the migration command are in [AGENTS.md](AGENTS.md#upgrading-vite).

## macOS Desktop Build (Tauri v2)

Uses the `dev`/`build` package scripts (via Vite+). Requires Rust (`rustup`) installed on macOS:

```bash
# Run native macOS window in dev mode (uses an isolated data store; see AGENTS.md)
cargo tauri dev --config '{"identifier":"com.forgevault.studio.audit"}'

# Build native macOS .app and .dmg bundle
cargo tauri build
```

## Core Features

- **Prompt Library**: Folders (e.g. Frontend, Backend), a full-screen reader that shows the complete prompt in a read-only editor with variables filled in before you copy, parameterized `{{variable}}` templates, version history rollback, custom `#tag` filtering, duplicate detection (with Merge/Skip), and one-click copy in Raw, Agent XML, Markdown, or System JSON format.
- **Tech Stack Vault**: Dependency version matrices, architectural conventions, `package.json` / `Cargo.toml` manifest generators, duplicate detection, and multi-stack bulk export to consolidated `.md` or `.json` bundles.
- **Code Lessons (Monaco Split Studio)**: Resizable split-pane workspace pairing rich Markdown notes with a multi-file Monaco Editor.
- **Markdown Vault**: Dedicated `.md` document studio with live side-by-side preview and import/export.
- **Local-First IndexedDB (`forgevault_idb_v2`)**: Full workspace persistence. Export a JSON backup or a Markdown handbook; restore validates the file and asks for confirmation before replacing anything.
- **Offline**: Monaco and all fonts are bundled. The app makes no network requests.
