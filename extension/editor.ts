/**
 * polished-ui — composer (input editor) polish.
 *
 * Subclasses CustomEditor — the app-level editor that already provides
 * typing, multiline input, history, autocomplete, paste (+image-paste
 * fallback), kill-ring/undo, app keybindings, escape/ctrl+d, and extension
 * shortcuts — and overrides ONLY the chrome:
 *
 *   ──────────────────────────────────────────────────────────
 *    type a message… 
 *   ──────────────────────────────────────────────────────────
 *
 * - border: copper (accent) when focused, muted when inactive. Focus is
 *   exposed via Editor.focused (set by the TUI, which re-renders on focus
 *   change). Pi's thinking-level/bash-mode border writes are re-asserted
 *   away on every render — those states still function, only the border hue
 *   is ours (the footer still shows the thinking level).
 * - placeholder: muted, shown only while the text is empty; the fake
 *   inverse-space cursor and the IME hardware-cursor marker are preserved.
 * - breathing room: 1 column left/right is added around content when Pi's
 *   own editorPaddingX is 0, and only when the line has a trailing plain
 *   space to give up — padding collapses before content (no wrap, ANSI-safe).
 * - nothing else changes: behavior is 100% inherited from Pi.
 */

import { CustomEditor, type ExtensionContext, type KeybindingsManager, type Theme } from "@earendil-works/pi-coding-agent";
import type { EditorTheme, TUI } from "@earendil-works/pi-tui";
import { CURSOR_MARKER, visibleWidth } from "@earendil-works/pi-tui";

const PLACEHOLDER = "type a message…";

export class PolishedEditor extends CustomEditor {
	private readonly uiTheme: Theme;

	constructor(tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager, ctx: ExtensionContext) {
		super(tui, theme, keybindings, { paddingX: 0 });
		// ctx.ui.theme is a live proxy over globalThis — always the current theme.
		this.uiTheme = ctx.ui.theme;
	}

	override render(width: number): string[] {
		// Deterministic chrome. interactive-mode writes thinking-level/bash
		// border colors into this field between renders; we re-assert ours
		// at the start of every render so the composer always reads as
		// copper-when-focused / muted-when-inactive.
		this.borderColor = (str: string): string =>
			this.focused ? this.uiTheme.fg("accent", str) : this.uiTheme.fg("muted", str);

		const lines = super.render(width);
		if (lines.length < 3) return lines; // top border + content + bottom border

		const paddingX = this.getPaddingX();
		const extraLeft = paddingX > 0 ? 0 : 1; // Pi's own padding already provides room
		const isEmpty = this.getText().length === 0;

		// Content lines live between the top border (0) and bottom border (last).
		// (Autocomplete dropdown lines come after the bottom border — untouched.)
		for (let i = 1; i <= lines.length - 2; i++) {
			const line = lines[i]!;

			if (isEmpty && i === 1) {
				// Empty state: muted placeholder + preserved fake cursor/IME marker.
				const hint = this.uiTheme.fg("muted", PLACEHOLDER);
				const cursor = (this.focused ? CURSOR_MARKER : "") + "\x1b[7m \x1b[0m";
				const body = `${hint} ${cursor}`;
				const bodyWidth = visibleWidth(body);
				const leftPad = " ".repeat(paddingX + extraLeft);
				const rightPad = " ".repeat(Math.max(0, width - leftPad.length - bodyWidth));
				lines[i] = leftPad + body + rightPad;
				continue;
			}

			// Breathing room: only when the line ends with a plain space we can
			// give up (i.e. there is room) — full-width lines stay flush and
			// the line never exceeds the terminal width.
			if (extraLeft > 0 && line.endsWith(" ")) {
				lines[i] = ` ${line.slice(0, -1)}`;
			}
		}
		return lines;
	}
}
