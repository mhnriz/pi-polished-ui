/**
 * polished-ui — custom footer component.
 *
 * Replaces Pi's built-in footer with a single-line, width-responsive footer:
 *
 *   ~/project  main*  ↑189k ↓13k  ctx 10%  $0.017  (opencode-go) deepseek-v4-flash · max
 *
 * Layout
 *   left   : cwd (progressively shortened), git branch (+ dirty "*")
 *   right  : token counts, context %, session cost,
 *            model (copper accent, provider prefix when >1 provider), thinking level
 *
 * Extension statuses are NOT rendered here — the status lane
 * (status-lane.ts) is the sole presentation surface for ctx.ui.setStatus().
 *
 * Responsive rule (drop order): tokens → cost → thinking → branch.
 * Always preserved: cwd, context %, model. cwd is shortened before removal;
 * the model is shortened (provider dropped, then truncated) only as a last resort.
 *
 * Metrics are reproduced faithfully from Pi's own logic:
 *   - token/cost totals: iterative sum over session entries, identical to
 *     core/usage-totals.ts (createUsageTotals + addUsageToTotals)
 *   - context usage: ctx.getContextUsage(), which interactive-mode wires to the
 *     exact same session.getContextUsage() the built-in footer uses
 *   - formatTokens(): mirrors modes/interactive/components/footer.js
 *
 * Colors come exclusively from the active Theme (hariz-dark in production) —
 * no hard-coded ANSI.
 */

import type {
	ContextUsage,
	ExtensionAPI,
	ExtensionContext,
	ReadonlyFooterDataProvider,
	Theme,
} from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { COLLAPSE_GLYPH, MIDDOT, shortenCwdVariants } from "./components.js";

// Minimal ambient declarations so this file type-checks without @types/node.
// These are type-only; at runtime the node globals exist in the pi host process.
declare function setTimeout(handler: () => void, timeout?: number): unknown;
declare function clearTimeout(handle: unknown): void;

/** Two-space separator between metric groups (see render previews). */
const SEP = "  ";
/** Minimum interval between `git status` dirty-checks. */
const GIT_DIRTY_REFRESH_MS = 5000;

/** Segments dropped first when width runs out, in this exact order. */
const DROP_ORDER = ["tokens", "cost", "branch", "think"] as const;
/** Minimum gap between the left and right clusters (mirrors built-in minPadding). */
const MIN_GAP = 2;

interface FooterEnv {
	pi: ExtensionAPI;
	ctx: ExtensionContext;
	tui: TUI;
	theme: Theme;
	footerData: ReadonlyFooterDataProvider;
}

interface UsageTotals {
	input: number;
	output: number;
	cost: number;
}

interface Metrics {
	cwd: string;
	model: ExtensionContext["model"];
	thinking: ExtensionContext["thinkingLevel"];
	contextUsage: ContextUsage | undefined;
	totals: UsageTotals;
}

type Segment = { key: string; text: string };

// ---------------------------------------------------------------------------
// Faithful re-implementations of Pi's internal helpers (display-only math).
// ---------------------------------------------------------------------------

/** Mirrors footer.js formatTokens() exactly. */
function formatTokens(count: number): string {
	if (count < 1000) return count.toString();
	if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
	if (count < 1000000) return `${Math.round(count / 1000)}k`;
	if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`;
	return `${Math.round(count / 1000000)}M`;
}

/** Mirrors core/usage-totals.ts addUsageToTotals() for the fields we display. */
function addUsage(totals: UsageTotals, usage: { input: number; output: number; cost: { total: number } }): void {
	totals.input += usage.input;
	totals.output += usage.output;
	totals.cost += usage.cost.total;
}

function fmtPercent(percent: number): string {
	const s = percent.toFixed(1);
	return s.endsWith(".0") ? s.slice(0, -2) : s;
}

// ---------------------------------------------------------------------------
// Footer view
// ---------------------------------------------------------------------------

/**
 * Builds the custom footer. The returned object satisfies the TUI Component
 * contract and carries a dispose() that releases subscriptions/timers so
 * setFooter(undefined) / reinstallation is clean.
 */
export function createCustomFooter(env: FooterEnv): Component & { dispose(): void } {
	const { pi, ctx, tui, theme, footerData } = env;

	// --- dirty-working-tree marker (best-effort; degrades to no marker) ---
	let gitDirty: boolean | null = null; // null = unknown / not a repo
	let dirtyCheckTimer: unknown;
	let lastDirtyCheck = 0;

	const scheduleDirtyCheck = (): void => {
		if (dirtyCheckTimer !== undefined) return;
		dirtyCheckTimer = setTimeout(() => {
			dirtyCheckTimer = undefined;
			void runDirtyCheck();
		}, 250);
	};

	const hasUsableBranch = (): boolean => {
		const branch = footerData.getGitBranch();
		return branch !== null && branch !== "detached";
	};

	async function runDirtyCheck(): Promise<void> {
		if (!hasUsableBranch()) {
			if (gitDirty !== null) {
				gitDirty = null;
				tui.requestRender();
			}
			return;
		}
		const now = Date.now();
		if (now - lastDirtyCheck < GIT_DIRTY_REFRESH_MS) return; // throttled
		lastDirtyCheck = now;
		try {
			// --untracked-files=no: the "*" reflects tracked modifications only,
			// so stray untracked files (node_modules, build output) don't pin
			// the marker on permanently.
			const res = await pi.exec(
				"git",
				["status", "--porcelain", "--untracked-files=no"],
				{ cwd: ctx.cwd, timeout: 2000 },
			);
			const dirty = res.code === 0 ? res.stdout.trim().length > 0 : null;
			if (dirty !== gitDirty) {
				gitDirty = dirty;
				tui.requestRender();
			}
		} catch {
			if (gitDirty !== null) {
				gitDirty = null;
				tui.requestRender();
			}
		}
	}

	// --- metrics cache (cheap signature: entries length + leaf id) ---
	let metricsSignature = "";
	let cachedMetrics: Metrics | undefined;

	const getMetrics = (): Metrics => {
		const entries = ctx.sessionManager.getEntries();
		const leafId = ctx.sessionManager.getLeafId();
		const signature = `${entries.length}:${leafId}`;
		if (cachedMetrics && metricsSignature === signature) return cachedMetrics;

		const totals: UsageTotals = { input: 0, output: 0, cost: 0 };
		for (const entry of entries) {
			if (entry.type === "message") {
				const m = entry.message;
				// Same contribution stream as the built-in footer:
				// assistant usage, toolResult usage, branch summary / compaction usage.
				if (m.role === "assistant") {
					addUsage(totals, m.usage);
				} else if (m.role === "toolResult" && m.usage) {
					addUsage(totals, m.usage);
				}
			} else if ((entry.type === "branch_summary" || entry.type === "compaction") && entry.usage) {
				addUsage(totals, entry.usage);
			}
		}

		const metrics: Metrics = {
			cwd: ctx.sessionManager.getCwd(),
			model: ctx.model,
			thinking: ctx.thinkingLevel,
			contextUsage: ctx.getContextUsage(),
			totals,
		};
		metricsSignature = signature;
		cachedMetrics = metrics;
		return metrics;
	};

	const buildContextSegment = (metrics: Metrics): string => {
		const percent = metrics.contextUsage?.percent;
		if (percent === null || percent === undefined) return theme.fg("dim", "ctx ?");
		const label = `ctx ${fmtPercent(percent)}%`;
		if (percent > 90) return theme.fg("error", label);
		if (percent > 70) return theme.fg("warning", label);
		return theme.fg("dim", label);
	};

	const buildModelSegment = (metrics: Metrics, withProvider: boolean): string => {
		const model = metrics.model;
		if (!model) return theme.fg("dim", "no-model");
		const provider =
			withProvider && footerData.getAvailableProviderCount() > 1
				? theme.fg("dim", `(${model.provider}) `)
				: "";
		return provider + theme.fg("accent", model.id);
	};

	/** Joins segments; the model→thinking pair uses a dimmed middot glue. */
	const join = (parts: Segment[]): string => {
		let out = "";
		for (let i = 0; i < parts.length; i++) {
			const part = parts[i]!;
			if (i > 0) {
				const prev = parts[i - 1]!;
				out += prev.key === "model" ? ` ${theme.fg("dim", MIDDOT)} ` : SEP;
			}
			out += part.text;
		}
		return out;
	};

	const buildLine = (width: number): string => {
		const metrics = getMetrics();
		const branch = footerData.getGitBranch();
		const gitMarker = hasUsableBranch() && gitDirty === true ? "*" : "";

		// Left cluster: cwd (longest variant first) + git branch.
		const leftParts: Segment[] = [
			{ key: "cwd", text: theme.fg("text", shortenCwdVariants(metrics.cwd)[0]!) },
		];
		if (branch) {
			leftParts.push({ key: "branch", text: theme.fg("muted", `${branch}${gitMarker}`) });
		}

		// Right cluster, in the design's visual order. Persistent telemetry only:
		// extension statuses belong to the status lane (status-lane.ts).
		const rightParts: Segment[] = [
			{ key: "tokens", text: theme.fg("dim", `↑${formatTokens(metrics.totals.input)} ↓${formatTokens(metrics.totals.output)}`) },
			{ key: "ctx", text: buildContextSegment(metrics) },
		];
		if (metrics.totals.cost > 0) {
			rightParts.push({ key: "cost", text: theme.fg("dim", `$${metrics.totals.cost.toFixed(3)}`) });
		}
		rightParts.push({ key: "model", text: buildModelSegment(metrics, true) });
		if (metrics.model?.reasoning && metrics.thinking && metrics.thinking !== "off") {
			rightParts.push({ key: "think", text: theme.fg("muted", metrics.thinking) });
		}

		const assemble = (): string => {
			const l = join(leftParts);
			const r = join(rightParts);
			const gap = width - visibleWidth(l) - visibleWidth(r);
			// Never let the clusters touch; below MIN_GAP counts as overflow so the
			// squeeze phases keep removing/compressing content.
			return gap >= MIN_GAP ? l + " ".repeat(gap) + r : l + " ".repeat(MIN_GAP) + r;
		};
		const fits = (): boolean => visibleWidth(assemble()) <= width;

		const removeSegment = (key: string): boolean => {
			for (const side of [leftParts, rightParts]) {
				const idx = side.findIndex((s) => s.key === key);
				if (idx >= 0) {
					side.splice(idx, 1);
					return true;
				}
			}
			return false;
		};

		// 1. Full layout.
		if (fits()) return assemble();

		// 2. Drop phase, in design priority order.
		for (const key of DROP_ORDER) {
			if (removeSegment(key) && fits()) return assemble();
		}

		// 3. Shorten cwd progressively (never remove it).
		const cwdVariants = shortenCwdVariants(metrics.cwd);
		const cwdIdx = leftParts.findIndex((s) => s.key === "cwd");
		for (let i = 1; i < cwdVariants.length; i++) {
			leftParts[cwdIdx] = { key: "cwd", text: theme.fg("text", cwdVariants[i]!) };
			if (fits()) return assemble();
		}

		// 4. Model: drop the provider prefix first.
		const modelIdx = rightParts.findIndex((s) => s.key === "model");
		if (modelIdx >= 0) {
			rightParts[modelIdx] = { key: "model", text: buildModelSegment(metrics, false) };
			if (fits()) return assemble();
			// Truncate the model itself (absolutely last resort per design).
			const raw = rightParts[modelIdx]!.text;
			let lo = 0;
			let hi = visibleWidth(raw);
			while (lo <= hi) {
				const mid = (lo + hi) >> 1;
				rightParts[modelIdx] = { key: "model", text: truncateToWidth(raw, mid, COLLAPSE_GLYPH) };
				if (fits()) lo = mid + 1;
				else hi = mid - 1;
			}
			rightParts[modelIdx] = { key: "model", text: truncateToWidth(raw, Math.max(0, hi), COLLAPSE_GLYPH) };
			if (fits()) return assemble();
		}

		// 5. Absolute guarantee: never wrap (ANSI-safe truncation).
		return truncateToWidth(assemble(), width, "");
	};

	// --- subscriptions + lifecycle ---
	// Re-check dirty state opportunistically on renders (throttled internally).
	const unsubBranch = footerData.onBranchChange(() => {
		gitDirty = null;
		scheduleDirtyCheck();
		tui.requestRender();
	});
	scheduleDirtyCheck();

	return {
		render(width: number): string[] {
			// Opportunistic dirty re-check while active (at most once per refresh
			// window — the throttle keeps git from being hammered during streams).
			if (hasUsableBranch() && Date.now() - lastDirtyCheck >= GIT_DIRTY_REFRESH_MS) {
				scheduleDirtyCheck();
			}
			return [buildLine(width)];
		},
		invalidate(): void {
			metricsSignature = "";
			cachedMetrics = undefined;
		},
		dispose(): void {
			unsubBranch();
			if (dirtyCheckTimer !== undefined) {
				clearTimeout(dirtyCheckTimer);
				dirtyCheckTimer = undefined;
			}
		},
	};
}