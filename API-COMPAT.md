# API Compatibility — pi-polished-ui v1.0.0

Every external API/type polished-ui depends on, why, where from, how stable it is, and what breaks if Pi changes it.

**Legend**
- **public** — documented Pi extension / TUI API (stable-ish by intent).
- **shipped-internal** — public TypeScript surface of a shipped class, but part of implementation that Pi code also mutates directly (not a documented extension contract).
- **behavioral** — not an API call; a behavior of Pi's runtime we rely on.

---

## Ui context methods (via `ctx.ui`)

| API | Why we use it | Source | Stability | If it breaks |
|---|---|---|---|---|
| `setFooter(factory)` | Replace the built-in footer; receive the `ReadonlyFooterDataProvider` (the only place it's exposed) | `ExtensionUIContext` — `@earendil-works/pi-coding-agent` | public | Footer stops installing; status-lane loses its source. |
| `setHeader(factory)` | Replace the startup header | `ExtensionUIContext` | public | Header stops installing. |
| `setWidget(key, factory, { placement })` | Status lane widget above the composer (`placement: "aboveEditor"`); key `polished-ui.status-lane` | `ExtensionUIContext`, `WidgetPlacement` | public | Lane stops rendering; `setWidget(key, undefined)` restore no longer possible. |
| `setEditorComponent(factory)` | Install `PolishedEditor` (chrome-only subclass) | `ExtensionUIContext`, `EditorFactory` | public | Composer chrome/placeholder lost. |
| `setWorkingIndicator({frames, intervalMs})` | Copper `◇ ◈ ◆ ◈` pulse; frames rendered **verbatim** (we color them) | `ExtensionUIContext`, `WorkingIndicatorOptions` | public | Working indicator reverts to stock spinner or breaks. |
| `setWorkingMessage(text)` | Muted `Working…` message | `ExtensionUIContext` | public | Message reverts to default. |
| `setHiddenThinkingLabel(text)` | `◆ Thinking` collapsed-label | `ExtensionUIContext` | public | Label reverts to `Thinking...`. |
| `getTheme()` / `theme` getter | Read tokens live (`ctx.ui.theme.fg("accent", …)`); proxy over `globalThis`, reflects hot theme reloads | `ExtensionUIContext` | public | Token reads throw; all colors break. |
| `setStatus(key, text)` (not called by us — read via footerData) | Populates the status map the lane displays | `ExtensionUIContext` | public | Lane has nothing to render; no direct break, but the feature loses its source. |

## ExtensionContext / api fields

| Field | Used for | Source | Stability | If it breaks |
|---|---|---|---|---|
| `ctx.mode` | Gate installs to `"tui"` | `ExtensionContext` | public | TUI-only surfaces install in rpc/json/print (usually no-op, but guard matters). |
| `ctx.cwd` | `git` calls for the dirty/branch markers | `ExtensionContext` | public | Git markers/wrong-directory. |
| `ctx.sessionManager.getEntries()/getLeafId()/getCwd()` | Footer metric totals + cwd | `ReadonlySessionManager` | public | Footer metric math/cwd display. |
| `ctx.model` | Footer/header model name, `reasoning` gating | `ExtensionContext` → `Model` | public | Model display/thinking segment. |
| `ctx.thinkingLevel` | Footer thinking segment | `ExtensionContext` → `ThinkingLevel` | public | Thinking segment. |
| `ctx.getContextUsage()` | Context % — wired by Pi to `session.getContextUsage()` | `ExtensionContext` → `ContextUsage` | public | `ctx ?` fallback shows; %. |
| `pi.on("model_select"/"thinking_level_select"/"turn_end"/"agent_settled")` | Redraw hooks (module-level, no unsubscribe) | `ExtensionAPI` | public | Footer/header stale after model/turn changes. |
| `pi.on("session_start")` | Install all surfaces per session | `ExtensionAPI` | public | Nothing installs. |
| `pi.exec(git, …)` | Best-effort branch + dirty markers (when footerData lacks them / for `*`) | `ExtensionAPI` (`ExecOptions.cwd`) | public | Markers degrade to absent (by design). |

## FooterDataProvider (passed to the footer factory)

From `@earendil-works/pi-coding-agent`, `core/footer-data-provider.ts`. Exposed read-only as `ReadonlyFooterDataProvider`.

| Member | Used for | Stability | If it breaks |
|---|---|---|---|
| `getGitBranch()` | Footer/header branch | public (read-only projection) | Branch column disappears. |
| `getExtensionStatuses()` | Status lane source (routed internally from the footer install) | public | **Lane loses its entire data source — no public alternative exists.** |
| `getAvailableProviderCount()` | Provider prefix `(provider) ` when > 1 | public | Prefix logic no-ops. |
| `onBranchChange(cb)` | Footer redraw + dirty re-check on branch switch | public | Stale branch after checkout. |

> **Key limitation:** statuses are the property of the `FooterDataProvider`, and extensions only reach them through the `setFooter` factory. The lane therefore depends on the footer being installed by the same extension (internal coupling in `index.ts`). There is **no severity metadata** (string map only), **no change callback** (updates ride on Pi's `requestRender()` inside `setExtensionStatus`), and **no read-back getter**.

## Editor class (composer)

| API | Used for | Source | Stability | If it breaks |
|---|---|---|---|---|
| `CustomEditor` (subclass `PolishedEditor`) | Inherit all editing behavior + app keybindings | `@earendil-works/pi-coding-agent` (`modes/interactive/components/custom-editor.ts`) | shipped-internal (public class, but not a long-term extension contract) | Subclass fails to construct or behavior drifts. |
| `Editor.focused` | Copper/muted border state (set by the TUI on focus change + re-render) | `@earendil-works/pi-tui` `Editor` | shipped-internal | Border can't track focus → falls back to a static style (we would hard-code one). |
| `Editor.getText()/getPaddingX()/getText()` | Empty check, placeholder, indentation | pi-tui | shipped-internal | Placeholder/padding logic. |
| `Editor.borderColor` field | Re-asserted each render (we override Pi's thinking/bash writes) | pi-tui | shipped-internal | If Pi stops writing thinking-level colors here, our render-time reset is still fine; if the field is removed, chrome breaks. |
| `setEditorComponent` wiring (onSubmit/onChange/text/borderColor/padding/autocomplete/`actionHandlers` copy) | Composer behaves exactly like the default editor | interactive-mode `setCustomEditorComponent` | **behavioral** (duck-typed in Pi) | Composer loses submit/history/autocomplete/etc. if this copy logic changes. |
| `CURSOR_MARKER` | IME hardware-cursor positioning in placeholder/cursor lines | `@earendil-works/pi-tui` | shipped-internal | Placeholder loses IME cursor positioning (cosmetic). |
| `\x1b[7m \x1b[0m` inverse-space cursor | Matches Pi's own fake-cursor rendering (not a color) | (Pi's editor does the same) | behavioral | Cosmetic only. |

## Theme APIs

From `@earendil-works/pi-coding-agent` (`modes/interactive/theme/theme.ts`).

| API | Used for | Stability | If it breaks |
|---|---|---|---|
| `theme.fg(token, text)` / `theme.bg(token, text)` | Every color emission | public | All colors. `theme` is a proxy over `globalThis`; missing init throws. |
| `ThemeColor` / `ThemeBg` token names (`accent`, `muted`, `dim`, `text`, `thinkingText`, `warning`, `error`, `success`…) | Token-selected rendering | public (schema in `theme-schema.json`) | Renamed/removed tokens fail at runtime or fall back. Added tokens are safe. |
| Theme JSON schema (`name`, `vars`, `colors`, optional `export`) | `hariz-dark.json` validity | public | Theme fails to load if shape changes (validator catches). |

## pi-tui utilities

From `@earendil-works/pi-tui`.

| API | Used for | Stability | If it breaks |
|---|---|---|---|
| `visibleWidth(str)` | All width math (never slice ANSI) | public | Width checks fail → wraps/misalignment. |
| `truncateToWidth(str, w, ellipsis)` | All truncation (footer, lane, header, model) | public | Truncation corrupts → wrap. |
| `Component` / `TUI` types | Component contracts (render/invalidate/dispose), `tui.requestRender()` | public | Type-check errors / redraws. |
| `EditorTheme` / `getEditorTheme()` | Editor constructor + autocomplete theme | public / `pi-coding-agent` | Editor chrome. |

## Re-implemented (no direct API) behavior

| Behavior | Mirrors | Risk |
|---|---|---|
| Token totals (↑↓) | `core/usage-totals.ts` `createUsageTotals`/`addUsageToTotals` over `getEntries()` | If Pi changes what counts as input/output/cost, the footer drifts (no public helper exists). |
| `formatTokens()` | `footer.js` | Cosmetic (rounding) if changed. |
| `sanitizeStatusText()` | `footer.js` | Cosmetic. |
| cwd `~`-shortening / collapse | `footer.js` `formatCwdForFooter` + our variant ladder | Cosmetic. |
| status update signal | Pi's `setExtensionStatus → ui.requestRender()` | If Pi stops re-rendering on `setStatus`, the lane stales until the next render. |

## Runtime assumptions (documented, not APIs)

- Node globals `process.env.HOME|USERPROFILE`, `setTimeout`, `clearTimeout` (ambient declarations in `components.ts`/`footer.ts` for type-checking without `@types/node`).
- Terminal glyphs `◆ ◈ ◇ ↑ ↓ · ─ …` (BMP, same class as Pi's own glyphs).
- `git` on `PATH` for the header branch line and the footer `*` dirty marker (both degrade to absent on failure).
- npm-global Pi layout (`pi` on `PATH`) for `scripts/validate.sh` discovery.
