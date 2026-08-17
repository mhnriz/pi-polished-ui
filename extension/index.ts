/**
 * polished-ui v1 — cohesive TUI presentation layer for the pi coding agent.
 *
 * Modular entry point. Each surface lives in its own module:
 *   footer.ts      — responsive single-line telemetry footer
 *   header.ts      — minimal startup header (π · cwd · branch · model)
 *   working.ts     — streaming working indicator config
 *   editor.ts      — composer chrome (placeholder + focus border), behavior inherited
 *   status-lane.ts — generic status lane (sole ctx.ui.setStatus() surface)
 *   components.ts  — shared string/width helpers
 *
 * See README.md and API-COMPAT.md in the repo root for usage and the exact
 * Pi API surface this extension depends on.
 *
 * All surfaces are installed per session_start (TUI mode only) and cleanly
 * replace their predecessors: interactive-mode disposes the previous custom
 * footer/header when setFooter/setHeader is called again, and resetExtensionUI
 * clears working-message/indicator/label state before each session, so
 * /reload, /new, /resume and /fork reinstall without duplication.
 *
 * The redraw registry lets any surface subscribe to events that change the
 * data it renders (model, thinking level, turn end, agent settle) without
 * per-surface pi.on registrations (pi.on has no unsubscribe).
 */

import type { ExtensionAPI, ReadonlyFooterDataProvider } from "@earendil-works/pi-coding-agent";
import { createCustomFooter } from "./footer.js";
import { installHeader } from "./header.js";
import { installWorkingIndicator } from "./working.js";
import { PolishedEditor } from "./editor.js";
import { installStatusLane } from "./status-lane.js";

/** Label shown for collapsed thinking blocks (see report for color notes). */
const HIDDEN_THINKING_LABEL = "◆ Thinking";
const NO_STATUSES: ReadonlyMap<string, string> = new Map();

export default function (pi: ExtensionAPI) {
	let redrawFns: Set<() => void> | undefined;

	const registerRedraw = (fn: () => void): (() => void) => {
		redrawFns ??= new Set();
		redrawFns.add(fn);
		return () => {
			redrawFns?.delete(fn);
		};
	};
	const redrawAll = (): void => {
		redrawFns?.forEach((fn) => fn());
	};

	// Data the surfaces display changes outside the normal render loop.
	pi.on("model_select", redrawAll);
	pi.on("thinking_level_select", redrawAll);
	pi.on("turn_end", redrawAll);
	pi.on("agent_settled", redrawAll);

	pi.on("session_start", (_event, ctx) => {
		if (ctx.mode !== "tui") return; // footer/header/indicator are interactive surfaces

		// --- Footer ---
		// The footer factory is the ONLY place Pi hands us the
		// ReadonlyFooterDataProvider; we route its status map to the lane so
		// there is a single source of truth for extension statuses.
		let statusSource: ReadonlyFooterDataProvider | undefined;
		ctx.ui.setFooter((tui, theme, footerData) => {
			statusSource = footerData;
			const footer = createCustomFooter({ pi, ctx, tui, theme, footerData });
			const unregister = registerRedraw(() => tui.requestRender());
			const originalDispose = footer.dispose;
			footer.dispose = () => {
				unregister();
				originalDispose();
			};
			return footer;
		});

		// --- Status lane (generic, above the composer) ---
		installStatusLane(ctx, () => statusSource?.getExtensionStatuses() ?? NO_STATUSES);

		// --- Header ---
		installHeader(pi, ctx, registerRedraw);

		// --- Working indicator (frames + message) ---
		installWorkingIndicator(ctx);

		// --- Composer: chrome-only editor subclass (behavior fully inherited) ---
		ctx.ui.setEditorComponent((tui, theme, keybindings) => new PolishedEditor(tui, theme, keybindings, ctx));

		// --- Hidden thinking label ---
		ctx.ui.setHiddenThinkingLabel(HIDDEN_THINKING_LABEL);
	});
}
