/**
 * polished-ui — generic status lane.
 *
 * A single-line presentation surface rendered directly above the composer via
 * ctx.ui.setWidget(..., { placement: "aboveEditor" }). It knows NOTHING about
 * specific extensions or projects: it simply renders zero or more status
 * texts from a read-only source in a consistent style.
 *
 *   ◆ plan mode · sync pending · 2 warnings
 *   ────────────────────────────────────────
 *    type a message…
 *
 * - source: the FooterDataProvider's extension-status map (populated by
 *   ctx.ui.setStatus from ANY extension) — the same single source the
 *   built-in footer reads. polished-ui routes it internally from the footer
 *   install; no private registry, no monkey-patching.
 * - updates: interactive-mode calls ui.requestRender() on every setStatus,
 *   so this widget's render() re-runs whenever a status changes — no
 *   polling, no subscriptions.
 * - empty state: render() returns [] → zero vertical space (the TUI's own
 *   layout spacer above the editor is unchanged).
 * - responsive: never wraps; earliest statuses are kept; text is truncated
 *   (ANSI-safe, ellipsis reserved) before items are dropped; below a
 *   readability budget it prefers ONE clean truncated item over several
 *   unreadable fragments (e.g. `◆ sync…` over `◆ pla… · sy… · wa…`).
 */

import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { sanitizeStatusText } from "./components.js";

const WIDGET_KEY = "polished-ui.status-lane";
const GLYPH = "◆";
const TRUNCATION_GLYPH = "…";
/** Below this per-item visible budget, truncated fragments are unreadable → drop items instead. */
const MIN_READABLE_FRAGMENT = 16;

/** Read-only status source: returns the current extension status texts. */
export type StatusSource = () => ReadonlyMap<string, string>;

export const STATUS_LANE_KEY = WIDGET_KEY;

export function installStatusLane(ctx: ExtensionContext, getStatuses: StatusSource): void {
	if (ctx.mode !== "tui") return;
	ctx.ui.setWidget(
		WIDGET_KEY,
		(_tui: TUI, theme: Theme) => createStatusLane({ theme, getStatuses }),
		{ placement: "aboveEditor" },
	);
}

function createStatusLane(env: { theme: Theme; getStatuses: StatusSource }): Component & { dispose?(): void } {
	const buildLine = (width: number): string[] => {
		const statuses = env.getStatuses();
		const items = [...statuses.values()].map(sanitizeStatusText).filter(Boolean);
		if (items.length === 0 || width <= 0) return [];

		const t = env.theme;
		const glyph = t.fg("accent", GLYPH);
		const sep = t.fg("dim", "·");

		// Item body: secondary color, applied AFTER truncation (truncation runs
		// on the raw text so ANSI stays valid). If an extension pre-styles its
		// status text (e.g. theme.fg("success", ...)), those inner codes win.
		const styleItem = (s: string): string => t.fg("muted", s);

		// cap=0 → no truncation.
		const lineFor = (list: string[], cap: number): string =>
			glyph +
			" " +
			list
				.map((s) => (cap > 0 ? truncateToWidth(s, cap, TRUNCATION_GLYPH) : s))
				.map(styleItem)
				.join(` ${sep} `);

		const fits = (list: string[], cap: number): boolean => visibleWidth(lineFor(list, cap)) <= width;

		// 1. Everything, untruncated.
		if (fits(items, 0)) return [lineFor(items, 0)];

		// Largest per-item cap (0 = untruncated) under which the whole set fits.
		const maxItemWidth = Math.max(...items.map((s) => visibleWidth(s)));
		const findCap = (list: string[]): number | undefined => {
			let lo = 0;
			let hi = maxItemWidth;
			let best: number | undefined;
			while (lo <= hi) {
				const mid = (lo + hi) >> 1;
				if (fits(list, mid)) {
					best = mid;
					lo = mid + 1;
				} else {
					hi = mid - 1;
				}
			}
			return best;
		};

		// 2. Fair per-item truncation while fragments stay readable.
		let cap = findCap(items);
		if (cap !== undefined && cap >= MIN_READABLE_FRAGMENT) return [lineFor(items, cap)];

		// 3. Drop newest items until fair truncation is readable again.
		let list = items;
		while (list.length > 1) {
			list = list.slice(0, -1);
			cap = findCap(list);
			if (cap !== undefined && cap >= MIN_READABLE_FRAGMENT) return [lineFor(list, cap)];
		}

		// 4. One clean item, truncated to fit (never wraps).
		const single = lineFor([items[0]!], 0);
		return [fits([items[0]!], 0) ? single : truncateToWidth(single, width, "")];
	};

	return {
		render(width: number): string[] {
			return buildLine(width);
		},
		invalidate(): void {
			// No cached state — statuses are read and laid out per render.
		},
	};
}
