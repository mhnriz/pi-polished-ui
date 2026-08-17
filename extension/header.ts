/**
 * polished-ui — startup header.
 *
 * Replaces the built-in header (logo + keybinding hints) with a minimal,
 * terminal-native banner:
 *
 *   π  ~/project · main                              deepseek-v4-flash
 *   ────────────────────────────────────────────────────────────────
 *
 * Information priority: π mark > cwd > git branch > model. No art, no help,
 * no version, no stats. The separator rule is muted and spans exactly the
 * terminal width, so it never wraps.
 *
 * Git branch is fetched once via `git branch --show-current` (standard CLI,
 * not Pi internals); on any failure the branch is simply omitted. Model is
 * read from ctx.model and refreshed through the shared redraw hook.
 */

import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { MIDDOT, shortenCwdVariants } from "./components.js";

const PI_MARK = "π";
const RULE_CHAR = "─";
const MIN_GAP = 2;

type Unregister = () => void;

export function installHeader(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	registerRedraw: (fn: () => void) => Unregister,
): void {
	ctx.ui.setHeader((tui, theme) => {
		const header = createHeaderComponent({ pi, ctx, tui, theme });
		const unregister = registerRedraw(() => tui.requestRender());
		const originalDispose = header.dispose;
		header.dispose = () => {
			unregister();
			originalDispose();
		};
		return header;
	});
}

function createHeaderComponent(env: {
	pi: ExtensionAPI;
	ctx: ExtensionContext;
	tui: TUI;
	theme: Theme;
}): Component & { dispose(): void } {
	const { pi, ctx, tui, theme } = env;

	let branch: string | null = null;
	let disposed = false;

	// One-shot branch resolution; omitted on failure/absence (no git).
	pi.exec("git", ["branch", "--show-current"], { cwd: ctx.cwd, timeout: 2000 })
		.then((res) => {
			if (disposed) return;
			const out = res.stdout.trim();
			branch = res.code === 0 && out ? out : null;
			tui.requestRender();
		})
		.catch(() => {
			if (!disposed) branch = null;
		});

	const buildLine = (width: number): string => {
		const modelId = ctx.model?.id;
		const variants = shortenCwdVariants(ctx.sessionManager.getCwd());

		// Left cluster: π mark + cwd + optional branch. Right: model (right-aligned).
		const line1 = (cwdStr: string, showModel: boolean, showBranch: boolean): string => {
			const left = `${theme.fg("accent", PI_MARK)}  ${theme.fg("text", cwdStr)}${
				showBranch && branch ? ` ${theme.fg("muted", MIDDOT)} ${theme.fg("muted", branch)}` : ""
			}`;
			const right = showModel && modelId ? theme.fg("accent", modelId) : "";
			if (!right) return left; // no trailing pad when the right side is empty
			const gap = width - visibleWidth(left) - visibleWidth(right);
			// Below MIN_GAP counts as overflow so the squeeze phases continue.
			return gap >= MIN_GAP ? left + " ".repeat(gap) + right : left + " ".repeat(MIN_GAP) + right;
		};
		const fits = (cwdStr: string, showModel: boolean, showBranch: boolean): boolean =>
			visibleWidth(line1(cwdStr, showModel, showBranch)) <= width;

		// Priority: π > cwd > branch > model. Model is dropped before branch;
		// cwd is shortened progressively; π + cwd are never removed.
		for (const variant of variants) {
			if (fits(variant, true, true)) return line1(variant, true, true);
			if (fits(variant, false, true)) return line1(variant, false, true);
			if (fits(variant, true, false)) return line1(variant, true, false);
			if (fits(variant, false, false)) return line1(variant, false, false);
		}
		// Absolute fallback: π + truncated shortest cwd (never wraps).
		const leaf = variants[variants.length - 1] ?? "~";
		return truncateToWidth(`${theme.fg("accent", PI_MARK)}  ${theme.fg("text", leaf)}`, width, "");
	};

	return {
		render(width: number): string[] {
			if (width <= 0) return ["", ""];
			const separator = theme.fg("muted", RULE_CHAR.repeat(width));
			return [buildLine(width), separator];
		},
		invalidate(): void {
			// No cached state; everything is recomputed per render.
		},
		dispose(): void {
			disposed = true;
		},
	};
}
