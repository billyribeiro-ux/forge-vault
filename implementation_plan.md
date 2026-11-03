# ForgeVault — Prompt Library, Tech Stack Vault & Code Lesson Workbench

ForgeVault is a fast, local-first developer studio designed for both web browsers and native macOS desktop via Tauri v2. It unifies a high-speed AI Prompt Library, a reusable Tech Stack Vault for instant copying into AI agents like Argon, and an interactive Code Lesson Workbench combining split-pane Markdown documentation with a multi-file Monaco Editor.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and UX decisions reflect your confirmed choices from our brainstorming phase:

- **Confirmed Decision 1 — Separate Prompt & Stack Libraries with Instant One-Click Copy**: Prompts and Tech Stacks live in dedicated, cleanly organized libraries with instant one-click copy buttons, customizable variable fill-ins, and format selectors (Markdown, XML tags, or system-prompt blocks) tailored for Argon and other AI coding agents.
- **Confirmed Decision 2 — Split-Pane Markdown & Multi-File Monaco Lesson Studio**: Code lessons feature a resizable split-pane layout pairing rich `.md` lesson authoring/preview on one side with a multi-tab Monaco Editor (supporting TypeScript, Rust, TSX, CSS, JSON, SQL, and Markdown) on the other.
- **Confirmed Decision 3 — Local-First IndexedDB Persistence + Full Bundle Import/Export**: All prompts, stacks, lessons, code files, and theme preferences are stored locally inside the app via IndexedDB with instant zero-latency queries, complemented by one-click JSON workspace backups, single `.md` file exports, and Tauri v2 desktop configuration files ready for native macOS builds.
- **Confirmed Decision 4 — Dual Light/Dark Theme Engine + Custom Studio Theme Builder**: Includes curated Light (`Paper Studio`) and Dark (`Obsidian Pro`) presets alongside an interactive Theme Customizer allowing real-time control over accent hues, surface contrast, editor syntax themes, and font sizing.

---

## 1. Overview & Core Concept

- **What It Does**: Provides a centralized, keyboard-first personal knowledge base and prompt engineering workbench where developers curate named prompts, maintain canonical tech stack definitions, write multi-file code lessons with Markdown guides, and search across everything in milliseconds via a global `⌘K` / `Ctrl+K` Command Palette.
- **Target Audience / Persona**: AI-augmented software engineers, technical educators, and indie builders who work daily with AI agents (Argon, Cursor, Claude, Windsurf) and want a zero-latency, offline-capable vault for their best prompts, stack blueprints, and architectural lessons.
- **Key Value**: Eliminates repetitive context typing when prompting AI agents and replaces scattered notes or gists with a unified, searchable Monaco + Markdown studio that runs identically in the browser or as a lightweight macOS Tauri v2 app.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Global Search & Command Palette (`⌘K`)**: Pressing `⌘K` from anywhere opens an instant fuzzy-search modal that searches across Prompt titles/bodies, Tech Stack blueprints, Code Lesson Markdown, and individual Monaco file contents—allowing immediate copy to clipboard or jump-to-edit with keyboard arrows.
2. **Prompt Library & Variable Quick-Copy**: Browse prompts by category (Architecture, Refactoring, Debugging, UI/UX, System Prompts, Testing). Clicking **Copy for Agent** copies the raw prompt immediately, or opens an inline variable popover if the prompt contains `{{variable}}` placeholders. Users can also copy as raw text, Markdown block, or `<prompt>` XML tags.
3. **Tech Stack Vault**: Maintain structured stack profiles (e.g., _Next.js 16 + React 19 + Tauri v2 + Tailwind v4_, _Rust + Axum + SQLite_, _Vite + TypeScript + Monaco_). Each stack stores core dependencies, architectural rules, and preferred conventions, with a one-click **Copy Stack Context** button formatted specifically for pasting into Argon.
4. **Code Lesson Workbench (Split-Pane `.md` + Multi-Tab Monaco)**:
   - **Left Pane**: Full Markdown (`.md`) lesson editor and live formatted preview with syntax-highlighted code blocks, callouts, and table of contents.
   - **Right Pane**: Genuine `@monaco-editor/react` workspace with multiple file tabs per lesson (e.g., `schema.ts`, `server.rs`, `App.tsx`, `notes.md`), language selector, line numbers, minimap toggle, word-wrap toggle, and one-click copy of single files or the entire lesson bundle.
5. **Tauri v2 macOS Readiness & Portable Data**: A dedicated **Portability & Tauri Desktop** drawer lets users export/import their entire database as a portable `.json` snapshot, download individual lessons as `.md` files, and inspect or copy the ready-to-use `tauri.conf.json` and Cargo configuration for compiling the native macOS `.dmg` / `.app`.

### Visual Identity & Theme

- **Aesthetic Direction**: High-craft developer utility inspired by Raycast, Linear, and Zed Editor—combining crisp 1px structural hairlines, generous breathing room, and zero visual clutter.
- **Dual-Theme + Customizer Palette**:
  - **Light Mode (`Paper Studio`)**: Crisp alabaster canvas (`#F8FAFC`), pure white elevated surfaces (`#FFFFFF`), slate-900 primary ink (`#0F172A`), and subtle cool-gray hairlines (`#E2E8F0`).
  - **Dark Mode (`Obsidian Pro`)**: Deep carbon-slate canvas (`#0B0F17`), elevated obsidian panels (`#111827`), crisp off-white typography (`#F1F5F9`), and subtle `#1E293B` structural borders.
  - **Customizable Accent & Surface Tokens**: User-adjustable accent presets (Indigo `#6366F1`, Emerald `#10B981`, Amber `#F59E0B`, Rose `#F43F5E`, Cyan `#06B6D4`, or custom hex picker) plus adjustable UI density and Monaco editor font size (`12px`–`18px`).
- **Typography & Hierarchy**:
  - _Display & Navigation_: `Plus Jakarta Sans` (SemiBold 600 / Bold 700, tight tracking) for workspace headers, section titles, and modal headings.
  - _Body & Markdown Prose_: `DM Sans` (Regular 400 / Medium 500) for high-legibility lesson prose and prompt descriptions.
  - _Code, Monaco & Tabular Metrics_: `JetBrains Mono` with `tabular-nums` for code editors, token/character counters, keyboard shortcuts, and timestamps.
- **Component Styling & Layout**:
  - **1440px Desktop Workspace**: Left navigation sidebar (`250px` fixed width) + compliant 3-zone top bar + full-height main viewport.
  - **Zero-Pill Metadata Discipline**: Category labels, token estimates, update timestamps, and file counts are rendered as quiet inline text separated by `·` bullets rather than cluttered pill badges.
  - **Single-Elevation Depth**: Flat panels bounded by 1px borders (`border-slate-200 dark:border-slate-800`) without nested card-in-card shadows.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Separate Libraries with Dedicated One-Click Copy Formats**
  - _Chosen Approach_: Keep Prompts and Tech Stacks in distinct, focused libraries where every card offers instant one-click copy alongside a format selector (Plain Text, Markdown, or Agent XML block).
  - _Why_: Matches your workflow of grabbing a specific prompt or stack on demand without forced multi-step assembly friction.
  - _Alternatives Considered_: Mandatory multi-step cart composer (rejected as slower for rapid single-item copy-paste into Argon).
- **Decision 2: Genuine Monaco Editor + Synchronized Markdown Split View**
  - _Chosen Approach_: Integrate `@monaco-editor/react` with multi-file tabs alongside a live Markdown editor/previewer and resizable split ratio.
  - _Why_: Gives full VS Code editing ergonomics (syntax highlighting, multi-cursor, code folding, bracket matching, search-and-replace) right inside each lesson.
  - _Alternatives Considered_: Basic `<textarea>` or lightweight prism highlighters (rejected because they lack real IDE features required for serious code lessons).
- **Decision 3: IndexedDB Local-First Engine with Automatic Seed Library**
  - _Chosen Approach_: Build an asynchronous IndexedDB storage engine (with automatic fallback and instant in-memory reactivity) pre-populated with realistic, state-of-the-art 2026 prompts, modern stacks (Next.js, React 19, Tauri v2, Rust, TypeScript), and comprehensive multi-file code lessons.
  - _Why_: Works 100% offline in both web browsers and Tauri macOS webviews, supports large multi-file code lessons without `localStorage` 5MB limits, and keeps all user data inside the app.

---

## 4. Technical Architecture & Data Strategy _(Technical Reference)_

### Architecture & Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                       ForgeVault Application Shell                           │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Top Bar (3-Zone): Brand Wordmark  │  4 Nav Links  │  Primary New CTA   │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────┬─────────────────────────────────────────────────────┐  │
│  │ Sidebar (250px)  │ Main Workspace Viewport                             │  │
│  │                  │                                                     │  │
│  │ • Quick Search   │  ┌───────────────────────────────────────────────┐  │  │
│  │   Trigger (⌘K)   │  │ View 1: Prompt Library                        │  │  │
│  │ • Workspace Nav  │  │ • Category Filter Bar & Search                │  │  │
│  │   - Prompts      │  │ • Prompt Grid/List with One-Click Agent Copy  │  │  │
│  │   - Tech Stacks  │  │ • Template Variable Fill Modal & Prompt Editor│  │  │
│  │   - Code Lessons │  ├───────────────────────────────────────────────┤  │  │
│  │   - Markdown Hub │  │ View 2: Tech Stack Vault                      │  │  │
│  │ • Pinned Items   │  │ • Stack Blueprints (Deps, Rules, Commands)    │  │  │
│  │ • Theme & Studio │  │ • One-Click Copy formatted for Argon / Agents │  │  │
│  │   Customizer     │  ├───────────────────────────────────────────────┤  │  │
│  │ • Backup / Tauri │  │ View 3: Code Lesson Studio (Split-Pane)       │  │  │
│  │   Bundle Export  │  │ • Left: .md Lesson Authoring & Live Preview   │  │  │
│  │                  │  │ • Right: Multi-Tab Monaco Editor + File Tree  │  │  │
│  └──────────────────┴──┴───────────────────────────────────────────────┴──┘  │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                  Local-First Persistence & Theme Engine                      │
│  ┌─────────────────────────┐  ┌────────────────────┐  ┌───────────────────┐  │
│  │ IndexedDB Vault Store   │  │ Theme & CSS Token  │  │ Bundle Exporter   │  │
│  │ • prompts[]             │  │ Controller         │  │ • JSON Workspace  │  │
│  │ • stacks[]              │  │ • Light / Dark     │  │ • .md File Export │  │
│  │ • lessons[] (files+.md) │  │ • Custom Accents   │  │ • Tauri v2 Config │  │
│  └─────────────────────────┘  └────────────────────┘  └───────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State

- **`PromptItem`**: `id`, `title`, `slug`, `category` (`System` | `Architecture` | `Refactor` | `Debugging` | `UI/UX` | `Testing`), `description`, `content` (supports `{{variable}}` tokens), `variables` (name + default value), `targetAgent` (`Argon`, `Universal`, `Claude`, `Cursor`), `isFavorite`, `copyCount`, `updatedAt`.
- **`TechStackItem`**: `id`, `name`, `tagline`, `layer` (`Full-Stack` | `Frontend` | `Desktop / Tauri` | `Backend`), `coreTechnologies` (array of name + version), `architectureRules` (bulleted markdown rules for AI agents), `setupCommands`, `agentSystemSnippet` (pre-formatted context block ready to paste into Argon), `isFavorite`, `updatedAt`.
- **`CodeLessonItem`**: `id`, `title`, `category`, `difficulty`, `summary`, `markdownNotes` (full `.md` lesson body), `files` (array of `LessonFile`: `id`, `filename`, `language`, `content`), `activeFileId`, `isFavorite`, `updatedAt`.
- **`ThemePreferences`**: `mode` (`light` | `dark`), `accentColor` (preset key or custom hex), `surfaceStyle` (`crisp` | `tinted` | `high-contrast`), `editorFontSize`, `editorMinimap`, `editorWordWrap`, `splitRatio`.

### Interactive Component & State Mapping

- **One-Click Copy & Clipboard Engine**: Every Prompt card, Tech Stack card, and Monaco file tab features a dedicated copy handler that formats the payload (Raw, Markdown, or XML Context Block), writes to the clipboard, increments `copyCount` in IndexedDB, and triggers a non-intrusive 180ms confirmation toast.
- **Template Variable Resolver**: If a user clicks **Copy with Variables** on a parameterized prompt, an interactive drawer lets them type custom values for each `{{variable}}` with live preview before copying to Argon.
- **Split-Pane Lesson Studio**: Users can toggle between `Split View`, `Markdown Only`, and `Monaco Code Only`, add/rename/delete code files within a lesson, switch syntax languages (`typescript`, `rust`, `json`, `css`, `html`, `markdown`, `sql`, `python`), and download any file or the full lesson as `.md`.
- **Global Command Palette (`⌘K`)**: Keyboard listener binds `Meta+K` / `Ctrl+K` to open an instant search overlay across all three collections with arrow-key navigation, `Enter` to open, and `⇧Enter` to copy directly to clipboard.
- **Theme Customizer Drawer**: Live-updates CSS custom properties (`--accent-primary`, `--surface-bg`, `--editor-font-size`) and toggles `.dark` on `document.documentElement` while syncing Monaco Editor's theme between `vs` (light) and `vs-dark` (dark).
