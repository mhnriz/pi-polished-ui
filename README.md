# pi-polished-ui

A cohesive, terminal-native presentation layer for the [pi coding agent](https://github.com/earendil-works/pi). Built as a standard pi **extension** plus a **theme**. No Pi core changes, no tool overrides.

**Version:** 1.0.1 · **Tested against Pi:** 0.84.2

```
pi-polished-ui/
├── package.json      Pi package manifest (pi.extensions + pi.themes) — enables `pi install git:...`
├── extension/        the pi extension (discovered via the package manifest)
├── themes/           hariz-dark.json + aira-zhr.json (both optional; pick one)
├── scripts/          install.sh (fallback installer) + validate.sh (health check)
└── README.md / CHANGELOG.md / API-COMPAT.md
```

---

## Purpose

polished-ui gives Pi a restrained, professional, long-session-friendly appearance while staying 100% terminal-native:

- **hariz-dark** — custom dark theme (copper accents, muted surfaces, no saturated full-width backgrounds).
- **aira-zhr** — custom dark theme (warm dusk palette: blush-rose accents, muted browns, sage/teal semantic tones).
- **Responsive footer** — cwd · git branch · token/context metrics · cost · model · thinking level, single line, drop-order-aware.
- **Minimal header** — `π  ~/cwd · branch` + model, with a muted rule.
- **Thinking / working presentation** — collapsed-thinking label `◆ Thinking`; restrained copper working indicator `◇ ◈ ◆ ◈`.
- **Composer** — `CustomEditor` subclass: copper-when-focused / muted-when-inactive border, muted placeholder; all Pi editing behavior inherited unchanged.
- **Generic status lane** — a single line above the composer that renders `ctx.ui.setStatus()` entries from **any** extension (the footer intentionally no longer shows statuses).

Every surface uses only **public Pi extension APIs** and **hariz-dark theme tokens** (no hard-coded colors).

## File architecture

| File | Role |
|------|------|
| `extension/index.ts` | Entry point. Installs footer, status lane, header, working indicator, composer, hidden-thinking label on every `session_start`. Owns the redraw registry. |
| `extension/footer.ts` | `createCustomFooter(env)` — telemetry footer layout, responsive squeeze, git-dirty marker. |
| `extension/header.ts` | `installHeader(pi, ctx, registerRedraw)` — minimal banner. |
| `extension/working.ts` | `installWorkingIndicator(ctx)` — working message + indicator frames. |
| `extension/editor.ts` | `PolishedEditor extends CustomEditor` — composer chrome only. |
| `extension/status-lane.ts` | `installStatusLane(ctx, getStatuses)` — generic status lane widget. |
| `extension/components.ts` | Shared pure helpers: cwd shortening, `MIDDOT`/`COLLAPSE_GLYPH`, status-text sanitizing. |
| `themes/hariz-dark.json` | The copper/muted theme (left untouched when working on aira-zhr). |
| `themes/aira-zhr.json` | The warm dusk theme — aira-zhr palette (`BG0-3`, `FG0-4`, semantic `RED/ORANGE/GREEN/TEAL/PURPLE`). |
| `scripts/install.sh` | Fallback manual installer (copy or `--dev` symlink) — **not** needed for the Pi package install. |
| `scripts/validate.sh` | Health check (imports, theme, API surface, render invariants). |
| `package.json` | Pi package manifest (`pi` key). This is what makes `pi install git:...` work. |

## Installation

### Prerequisites

- Pi **0.84.2+** with the npm-global layout (`pi` on `PATH`).
- Git and Node ≥ 20 (Pi uses them internally for package installs).

### Recommended: install as a Pi package

pi-polished-ui is a [Pi package](https://github.com/earendil-works/pi/blob/main/docs/packages.md):
`package.json` carries a `pi` manifest that declares the extension and themes. Install it
with Pi's native package installer:

```bash
pi install git:github.com/mhnriz/pi-polished-ui@v1.0.1
```

What happens (all inside Pi, nothing manual):

1. Pi clones the repository into `~/.pi/agent/git/github.com/mhnriz/pi-polished-ui` and pins the `v1.0.1` ref.
2. Pi reads the `pi` manifest and registers:
   - the polished-ui **extension** (`extension/` → `index.ts`),
   - both **themes** (`themes/hariz-dark.json`, `themes/aira-zhr.json`).
3. The extension activates on the next Pi start (or `/reload`); choose a theme via **Theme scope** below.

No manual `~/.pi` symlinks, no file copies, no bash, no Git commands.

### Updating

```bash
pi install git:github.com/mhnriz/pi-polished-ui@<new-tag>   # move to a newer pinned ref
# or reconcile every installed package to its pinned ref:
pi update --extensions
```

### Uninstalling

```bash
pi remove git:github.com/mhnriz/pi-polished-ui
# alias: pi uninstall git:github.com/mhnriz/pi-polished-ui
```

Then remove `"theme": "hariz-dark"` (or `"aira-zhr"`) from `~/.pi/agent/settings.json`
if you set it there, and restart Pi.

### Fallback: script install (manual / offline)

If you already cloned the repository and prefer the legacy path, `scripts/install.sh`
still works and is idempotent (copy mode, or `--dev` symlink mode):

```bash
cd ~/pi-polished-ui
./scripts/install.sh            # deploys extension + themes to ~/.pi
./scripts/validate.sh           # optional: verify everything
```

The installer creates `~/.pi/agent/extensions/` and `~/.pi/agent/themes/` if missing,
detects an existing `polished-ui` install (real dir or symlink), **backs it up**
(`*.bak-<timestamp>`) before replacing, and reports every action. It never silently
destroys an existing installation.

### Development (symlink) install

```bash
./scripts/install.sh --dev      # or --symlink
```

This symlinks `~/.pi/agent/extensions/polished-ui → <repo>/extension` and both themes
(`hariz-dark.json`, `aira-zhr.json`) into `~/.pi/agent/themes/`. Edit the repo, then in
Pi run `/reload` — changes apply immediately.

**Important:** the dev (symlink) install and the Pi package install load the same
resources, so **do not** run `pi install git:...` on a machine that already uses the dev
(or script) install — you would get duplicate extension surfaces. Pick one: package
install (normal users) **or** the dev symlink install (while developing the repo).

## Theme scope

Run `pi` with the theme for one session:

```bash
pi --use-theme hariz-dark   # copper/muted
pi --use-theme aira-zhr     # warm dusk (blush rose + muted browns)
```

To make it the default (edit `~/.pi/agent/settings.json`, **not** part of this repo):

```json
{ "theme": "hariz-dark" }
```

You can also pick it later via `/settings`. See `themes/*.json` (schema: `$schema` URL) and the Pi `docs/themes.md`.

> Both themes assume your terminal background matches the theme's *base* (`#171717` for hariz-dark, `#1e1210` for aira-zhr) and default foreground its *primary* (`#E8E6E3` / `#f5ede4`), matching the composer/editor body text, which uses the terminal default foreground.

## Responsive behavior

All surfaces test clean at **160 / 120 / 90 / 60 / 40** columns — chrome never wraps, ANSI stays valid, and each line is produced with `visibleWidth`/`truncateToWidth`.

- **Footer** drop order: token counts → cost → git branch → thinking level; then cwd shortening (full → `~/…/leaf` → leaf), then statuses… model last. cwd / context % / model always preserved.
- **Header** priority: `π` → cwd → branch → model (model dropped first, cwd shortened, `π`+cwd never removed).
- **Status lane**: earliest statuses kept; per-item truncation while readable (≥ 16 cols); then newest dropped; single clean truncated item at very narrow widths (`◆ sync…`, never `◆ pla… · sy… · wa…`).
- **Composer**: 1-column breathing room collapses before content; wraps inside the input well, never in its chrome.

## Lifecycle

Everything is installed per `session_start` (TUI mode only) and re-established cleanly across `/reload`, `/new`, `/resume`, `/fork` — exactly one header, footer, composer, working indicator and status-lane widget at any time. `resetExtensionUI()` in Pi clears extension UI state (working message/indicator, hidden-thinking label, widget map) before each session; the custom footer/header are swapped in place and disposed. No duplicate subscriptions, no stale entries, no retained state from a previous session.

## Known Pi API limitations

Documented in detail in [API-COMPAT.md](API-COMPAT.md). Highlights:

- **Extension statuses** are only observable through `setFooter`'s `ReadonlyFooterDataProvider`; there is **no severity metadata** and **no status-change event** (re-render is triggered by Pi's `requestRender` on `setStatus`). There is **no read-back getter** for statuses.
- **`setHiddenThinkingLabel`** accepts a single styled string → a two-tone copper `◆` + muted text label is impossible; the whole label uses the `thinkingText` token.
- **Footer metric math** (token totals, context %, cost) has no public helper — it is a faithful re-implementation over `ctx.sessionManager` entries and `ctx.getContextUsage()`, mirroring Pi's `core/usage-totals.ts` and `modes/interactive/components/footer.js`.
- **Composer body text** uses the terminal default foreground (no ANSI injection); the editor's thinking-level/bash border colors are superseded by focus-based chrome.
- **Working indicator** custom frames are rendered verbatim (we color them ourselves); compaction/retry loaders keep built-in styling.
- Terminal **glyph coverage** (`◆ ◈ ◇ ↑ ↓ ·`) cannot be detected through public APIs.

## Disable / uninstall

- **Remove the widget only:** `ctx.ui.setWidget("polished-ui.status-lane", undefined)` (or, temporarily, `ctx.ui.setFooter(undefined)` / `setHeader(undefined)` / `setEditorComponent(undefined)`).
- **Uninstall the package (Pi-native):**
  ```bash
  pi remove git:github.com/mhnriz/pi-polished-ui
  ```
  Then drop `"theme": "hariz-dark"` / `"aira-zhr"` from `~/.pi/agent/settings.json` and restart Pi.
- **Uninstall a manual/scripted install** (legacy):
  ```bash
  cd ~/pi-polished-ui
  ./scripts/install.sh --uninstall       # removes symlinks/copies, restores nothing, but reports
  # or manually:
  rm ~/.pi/agent/extensions/polished-ui
  rm ~/.pi/agent/themes/hariz-dark.json
  # remove "theme": "hariz-dark" from ~/.pi/agent/settings.json and run /reload
  ```
  Installer backups (`*.bak-<timestamp>`) are kept, never auto-deleted.

## Troubleshooting

- **Nothing changes after editing** → run `/reload` in the active Pi session (or restart). Verify install mode: `readlink ~/.pi/agent/extensions/polished-ui` should point at the repo for `--dev`.
- **"Theme not found"** at startup → confirm the package is installed (`pi list`) and that the theme name is `hariz-dark` or `aira-zhr` (`pi install git:...` registers both); for a manual install, run `./scripts/validate.sh` / `pi --use-theme hariz-dark`.
- **Odd colors** → ensure hariz-dark is the active theme (`/settings` or `--use-theme`) and your terminal supports 24-bit color (`echo $COLORTERM` = `truecolor`/`24bit`).
- **Footprint-like artifacts / wrap** → these are Pi-core layout elements (working-loader leading line, widget-container spacer, transcript) and cannot be changed via public APIs; not a polished-ui defect.
- **Errors referencing `jiti` or imports** → confirm the extension path is a real dir or a symlink to a readable path, then `/reload`.

## Upgrade checklist for future Pi versions

See [API-COMPAT.md](API-COMPAT.md) for the full dependency list. Before upgrading Pi, after upgrading, run:

```bash
cd ~/pi-polished-ui
./scripts/validate.sh
```

Then spot-check, in order of likely breakage:

1. Installed state: `pi list` shows the package; `pi update --extensions` reconciles it cleanly.
2. `pi --offline --use-theme hariz-dark` starts without extension errors.
3. Footer shows cwd/ctx/model correctly (metrics semantics unchanged).
4. Status lane appears when an extension calls `ctx.ui.setStatus` (or use a scratch `/test-status` command).
5. Composer shows copper border when focused, muted otherwise; typing/history/autocomplete/`!` still work.
6. `/reload` keeps exactly one of each surface.

## Recommended workflow

```
edit → /reload → ./scripts/validate.sh → git diff → commit → push
```
