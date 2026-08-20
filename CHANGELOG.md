# Changelog

All notable changes to pi-polished-ui.

## v1.0.1 — 2026-08-20

Package release — now installable as a native Pi package.

- **Pi package manifest** — added `package.json` with a `pi` manifest (`extensions: ["./extension"]`, `themes: ["./themes"]`) and the `pi-package` keyword, so Pi 0.84.2+ discovers the polished-ui extension and the `hariz-dark` / `aira-zhr` themes directly from the Git repository.
- **Native install** — `pi install git:github.com/mhnriz/pi-polished-ui@<tag>` replaces `install.sh` as the primary installation path. No manual `~/.pi` symlinks, no file copies, no bash required.
- **Update / uninstall** — `pi install git:github.com/mhnriz/pi-polished-ui@<new-tag>` (or `pi update --extensions`) and `pi remove git:github.com/mhnriz/pi-polished-ui`.
- **Peer deps declared only** — `@earendil-works/pi-coding-agent` / `@earendil-works/pi-tui` listed in `peerDependencies` per Pi's package docs (Pi disables peer auto-install for managed installs; nothing is bundled).
- No UI, theme, or behavior changes. `scripts/install.sh` remains as a fallback/manual dev-path installer.

## v1.0.0 — 2026-08-17

Initial release.

- **hariz-dark visual system** — custom dark theme (copper `#D69E72` accent, `#171717`/`#202020`/`#262626` surfaces, `#363432` borders, restrained desaturated backgrounds, tool/diff/syntax/thinking tokens).
- **Responsive footer** — single-line telemetry footer (cwd · git branch+dirty · ↑↓ tokens · ctx % · cost · model · thinking level) with drop-order squeeze, cwd shortening, ANSI-safe truncation; verified at 160/120/90/60/40. Extension statuses intentionally removed from the footer (Phase 6 — the status lane is the sole status surface).
- **Minimal header** — `π  ~/cwd · branch  model` + muted full-width rule; no logo art, no help text, no version.
- **Thinking / working presentation** — collapsed-thinking label `◆ Thinking` via `setHiddenThinkingLabel`; restrained copper working indicator `◇ ◈ ◆ ◈` (200 ms) with `Working…` message.
- **Polished composer** — `PolishedEditor extends CustomEditor`: copper-when-focused / muted-when-inactive border, muted `type a message…` placeholder, subtle 1-column breathing room; all typing/history/autocomplete/paste/`!`/keybinding behavior inherited unchanged.
- **Generic status lane** — `polished-ui.status-lane` widget above the composer presenting any extension's `ctx.ui.setStatus()` entries; earliest-first, truncate-before-drop, single clean item at narrow widths; zero vertical space when empty.

### Integration hardening (same release)

- Footer no longer duplicates statuses (status lane is the single source for `setStatus()`).
- Lifecycle verified across `/reload`, `/new`, `/resume`, `/fork` (exactly one of each surface).
- Repo tooling: idempotent `install.sh` (copy or `--dev` symlink, backups, `--uninstall`) and `validate.sh` health checks (import, theme schema, Pi API surface, render invariants).
- Docs: `README.md`, `API-COMPAT.md` (full public-API/type dependency inventory).
