@AGENTS.md

# Claude Code notes for ForgeVault

- The shared guide above is the source of truth for commands, toolchain versions, and rules.
- The user-level CLAUDE.md applies here. Its SvelteKit and Svelte-MCP sections do not apply, because this repo has no `.svelte` files. Its Rust-analyzer rules do apply to edits in `src-tauri/*.rs`.
- Scope validation to what changed. For a change under `src/`, run `pnpm exec vp check`. Run `pnpm exec vp build` once before a push, or when the build config, dependencies, or `vite.config.ts` changed.
- `pnpm exec vp test` is not a meaningful gate yet, because the repo has no tests. Do not claim tests pass.
