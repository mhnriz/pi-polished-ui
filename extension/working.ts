/**
 * polished-ui — streaming working indicator.
 *
 * Replaces Pi's stock spinner with a restrained copper pulse:
 *
 *   ◇  ◈  ◆  ◈    (200 ms)   →   ◇ Working…
 *
 * Requirements honored:
 * - every frame is a single-column BMP geometric glyph, so the animation
 *   never shifts horizontally (identical visible width per frame)
 * - frames are colored copper via ctx.ui.theme.fg("accent", …) — custom
 *   frames are rendered verbatim by pi-tui's Loader, so extensions must
 *   color them (docs/tui.md, Pattern 4b)
 * - message is muted by the built-in WorkingStatusIndicator message color fn
 * - single line, no background, no custom status strip
 *
 * Unicode note: ◆ ◈ ◇ are BMP Geometric Shapes with universal terminal
 * support (same glyph class as Pi's own default braille spinner); there is
 * no public API to detect terminal glyph coverage, so the requested glyphs
 * are used directly.
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

const FRAMES = ["◇", "◈", "◆", "◈"];
const INTERVAL_MS = 200;
const MESSAGE = "Working…";

export function installWorkingIndicator(ctx: ExtensionContext): void {
	const accent = (glyph: string): string => ctx.ui.theme.fg("accent", glyph);
	ctx.ui.setWorkingMessage(MESSAGE);
	ctx.ui.setWorkingIndicator({ frames: FRAMES.map(accent), intervalMs: INTERVAL_MS });
}
