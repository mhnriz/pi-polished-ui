// pi-polished-ui validator (node ESM).
//
// Verifies, against the installed pi package:
//   1. hariz-dark.json loads through Pi's real theme loader (schema + every
//      color token resolves, truecolor and 256color).
//   2. the extension imports successfully through Pi's own loader (jiti +
//      the same package aliases loader.js uses).
//   3. responsive render invariants for header/status-lane/editor/footer at
//      160/120/90/60/40: no line exceeds the width, ANSI is well-formed, the
//      footer no longer renders extension statuses, the lane still does, and
//      the footer keeps its drop order (tokens dropped first, cwd/ctx/model
//      preserved).
//   4. the required Pi extension/TUI API names still exist in the installed
//      package's type declarations.
//
// Env: PI_PKG (pi package dir), PI_AGENT_DIR, THEME_FILE.
//
// Run standalone:  PI_PKG=... node scripts/validate.mjs
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const SCRIPT_DIR = fileURLToPath(new URL(".", import.meta.url));

function findPiPackage() {
	if (process.env.PI_PKG && existsSync(process.env.PI_PKG)) return process.env.PI_PKG;
	try {
		const root = execSync("npm root -g", { encoding: "utf8" }).trim();
		const p = `${root}/@earendil-works/pi-coding-agent`;
		if (existsSync(p)) return p;
	} catch {}
	throw new Error("cannot locate the pi package (set PI_PKG)");
}

function findPiAgentDir() {
	return process.env.PI_AGENT_DIR || `${process.env.HOME}/.pi/agent`;
}

const PI_PKG = findPiPackage();
const AGENT = findPiAgentDir();
const THEME_FILE = process.env.THEME_FILE || `${AGENT}/themes/hariz-dark.json`;
const EXT_INDEX = `${AGENT}/extensions/polished-ui/index.ts`;

// --- host-resolved package entries (mirrors loader.js getAliases) ---------
// The @earendil-works/* packages are nested dependencies of pi-coding-agent;
// several (pi-ai, jiti) have no resolvable package "exports", so we use the
// same direct-under-node_modules layout the pi loader relies on.
const NM = `${PI_PKG}/node_modules`;
const exists = (p) => existsSync(p);
const PI_TUI = `${NM}/@earendil-works/pi-tui/dist/index.js`;
const PI_AI_ROOT = `${NM}/@earendil-works/pi-ai`;
const PI_AI = `${PI_AI_ROOT}/dist/compat.js`;
const PI_AI_OAUTH = `${PI_AI_ROOT}/dist/oauth.js`;
const PI_AI_PROVIDERS = `${PI_AI_ROOT}/dist/providers/all.js`;
const PI_AGENT_CORE = `${NM}/@earendil-works/pi-agent-core/dist/index.js`;
const TYPEBOX = `${NM}/typebox/build/index.mjs`;
const TYPEBOX_COMPILE = `${NM}/typebox/build/compile/index.mjs`;
const TYPEBOX_VALUE = `${NM}/typebox/build/value/index.mjs`;
const jitiEntry = `${NM}/jiti/lib/jiti-static.mjs`;

for (const [name, p] of Object.entries({ PI_TUI, PI_AI, PI_AI_OAUTH, PI_AI_PROVIDERS, PI_AGENT_CORE, TYPEBOX, TYPEBOX_COMPILE, TYPEBOX_VALUE, jitiEntry })) {
	if (!exists(p)) throw new Error(`validator: package entry missing ${name} -> ${p} (is the pi package layout supported? set PI_PKG)`);
}

const alias = {
	"@earendil-works/pi-coding-agent": `${PI_PKG}/dist/index.js`,
	"@earendil-works/pi-tui": PI_TUI,
	"@earendil-works/pi-ai/compat": PI_AI,
	"@earendil-works/pi-ai/oauth": PI_AI_OAUTH,
	"@earendil-works/pi-ai/providers/all": PI_AI_PROVIDERS,
	"@earendil-works/pi-ai": PI_AI,
	"@earendil-works/pi-agent-core": PI_AGENT_CORE,
	typebox: TYPEBOX,
	"typebox/compile": TYPEBOX_COMPILE,
	"typebox/value": TYPEBOX_VALUE,
};

let jitiCreate;
{
	const jitiMod = await import(jitiEntry);
	jitiCreate = jitiMod.createJiti ?? jitiMod.default?.createJiti ?? jitiMod.default;
}
const jiti = jitiCreate(import.meta.url, { alias });

const failures = [];
const check = (name, cond, detail) => {
	console.log(`${cond ? "  PASS" : "  FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
	if (!cond) failures.push(name);
};

// --- 1. theme through Pi's real loader ------------------------------------
const themeMod = await jiti.import(`${PI_PKG}/dist/modes/interactive/theme/theme.js`, {});
const { loadThemeFromPath, setThemeInstance } = themeMod;
const theme = loadThemeFromPath(THEME_FILE, "truecolor"); // throws on schema/vars/hex errors
const FG = ["accent","border","borderAccent","borderMuted","success","error","warning","muted","dim","text","thinkingText","userMessageText","customMessageText","customMessageLabel","toolTitle","toolOutput","mdHeading","mdLink","mdLinkUrl","mdCode","mdCodeBlock","mdCodeBlockBorder","mdQuote","mdQuoteBorder","mdHr","mdListBullet","toolDiffAdded","toolDiffRemoved","toolDiffContext","syntaxComment","syntaxKeyword","syntaxFunction","syntaxVariable","syntaxString","syntaxNumber","syntaxType","syntaxOperator","syntaxPunctuation","thinkingOff","thinkingMinimal","thinkingLow","thinkingMedium","thinkingHigh","thinkingXhigh","thinkingMax","bashMode"];
const BG = ["selectedBg","scrollbarThumb","searchMatchBg","userMessageBg","customMessageBg","toolPendingBg","toolSuccessBg","toolErrorBg"];
let tokenFail = 0;
for (const k of FG) { try { theme.fg(k, "x"); } catch { tokenFail++; } }
for (const k of BG) { try { theme.bg(k, "x"); } catch { tokenFail++; } }
check(`theme schema+all tokens resolve (${FG.length}+${BG.length})`, tokenFail === 0);
const t256 = loadThemeFromPath(THEME_FILE, "256color"); t256.fg("accent", "x"); check("theme 256-color fallback", true);
setThemeInstance(theme);
const themeProxy = themeMod.theme;

// --- 2. extension imports via Pi's loader ----------------------------------
const mod = await jiti.import(EXT_INDEX, { default: true });
check("extension imports + exports factory", typeof mod === "function");

// --- 3. render invariants ---------------------------------------------------
const visibleWidthMod = await jiti.import(`${PI_TUI}`, {});
const visibleWidth = visibleWidthMod.visibleWidth;
const { PolishedEditor } = await jiti.import(`${AGENT}/extensions/polished-ui/editor.ts`, {});
const { createCustomFooter } = await jiti.import(`${AGENT}/extensions/polished-ui/footer.ts`, {});
const { installHeader } = await jiti.import(`${AGENT}/extensions/polished-ui/header.ts`, {});
const { installStatusLane } = await jiti.import(`${AGENT}/extensions/polished-ui/status-lane.ts`, {});

const tui = { requestRender() {}, terminal: { rows: 30 } };
const { getEditorTheme } = themeMod;
const { KeybindingsManager } = await jiti.import(`${PI_PKG}/dist/core/keybindings.js`, {});

const entries = [
	{ type: "message", id: "u1", parentId: null, message: { role: "user", content: [{ type: "text", text: "hi" }], timestamp: 1 } },
	{ type: "message", id: "a1", parentId: "u1", message: { role: "assistant", content: [{ type: "text", text: "ok" }], usage: { input: 189000, output: 13000, cacheRead: 24000, cacheWrite: 9000, totalTokens: 202000, cost: { input: 0.0013, output: 0.0049, cacheRead: 0.0004, cacheWrite: 0.0001, total: 0.0067 } }, stopReason: "stop", timestamp: 2 } },
	{ type: "message", id: "t1", parentId: "a1", message: { role: "toolResult", toolName: "bash", toolCallId: "tc", content: [{ type: "text", text: "o" }], usage: { input: 0, output: 621, cacheRead: 0, cacheWrite: 0, totalTokens: 621, cost: { input: 0, output: 0.0103, cacheRead: 0, cacheWrite: 0, total: 0.0103 } }, timestamp: 3 } },
];
const statuses = new Map([
	["a", themeProxy.fg("muted", "plan mode")],
	["b", "sync pending"],
	["c", themeProxy.fg("warning", "2 warnings")],
]);
// Home-relative mock cwd so ~-collapse in the footer behaves like real life.
const mockCwd = `${process.env.HOME ?? "/home/user"}/project`;
const footerData = {
	getGitBranch: () => "main",
	getExtensionStatuses: () => statuses,
	getAvailableProviderCount: () => 1,
	onBranchChange: () => () => {},
};
const ctx = {
	mode: "tui", cwd: mockCwd,
	sessionManager: { getEntries: () => entries, getLeafId: () => "t1", getCwd: () => mockCwd },
	model: { id: "model-x", provider: "prov", reasoning: true, contextWindow: 128000, maxTokens: 65536, name: "M", cost: {}, input: ["text"], api: "openai-completions", baseUrl: "http://x", compat: {} },
	thinkingLevel: "max",
	getContextUsage: () => ({ tokens: 12800, contextWindow: 128000, percent: 10 }),
	ui: { theme: themeProxy }, isIdle: () => true, hasUI: true, modelRegistry: {}, scopedModels: [], signal: undefined,
	abort: () => {}, hasPendingMessages: () => false, shutdown: () => {}, compact: () => {}, getSystemPrompt: () => "",
};
const pi = { exec: async () => ({ code: 0, stdout: "main\n", stderr: "", killed: false }), on: () => {} };

const footer = createCustomFooter({ pi, ctx, tui, theme: themeProxy, footerData });
const editor = new PolishedEditor(tui, getEditorTheme(), KeybindingsManager.create(), ctx);
editor.focused = true; editor.setText("const x = 1;");
let headerF, laneF;
installHeader(pi, { ...ctx, ui: { ...ctx.ui, setHeader: (f) => { headerF = f(tui, themeProxy); } } }, () => () => {});
installStatusLane({ ...ctx, ui: { ...ctx.ui, setWidget: (k, f) => { laneF = f(tui, themeProxy); } } }, () => footerData.getExtensionStatuses());
await new Promise((r) => setTimeout(r, 250));

const widths = [160, 120, 90, 60, 40];
let wrapCount = 0, corruptCount = 0;
const stripAnsi = (s) => s.replace(/\u001b\[[0-9;]*m/g, "");
const ansiClean = (s) => {
	const cs = s.match(/\x1b\[[0-9;]*m/g) ?? [];
	const op = cs.filter((c) => !/^(\x1b\[39m|\x1b\[49m|\x1b\[0m)$/.test(c)).length;
	const cl = cs.filter((c) => /^(\x1b\[39m|\x1b\[49m|\x1b\[0m)$/.test(c)).length;
	return op <= cl + 1;
};
for (const w of widths) {
	for (const l of [...headerF.render(w), ...laneF.render(w), ...editor.render(w), ...footer.render(w)]) {
		if (visibleWidth(l) > w) wrapCount++;
		if (!ansiClean(l)) corruptCount++;
	}
}
check("render invariants: no line exceeds width (160..40)", wrapCount === 0, `${wrapCount} overflow lines`);
check("render invariants: ANSI well-formed", corruptCount === 0, `${corruptCount} suspicious lines`);
const footerAll = stripAnsi(footer.render(160).join(""));
const laneAll = stripAnsi(laneF.render(160).join(""));
check("footer no longer renders statuses", !footerAll.includes("plan mode"));
check("status lane renders all statuses", ["plan mode", "sync pending", "2 warnings"].every((s) => laneAll.includes(s)));
const f40 = stripAnsi(footer.render(40)[0] ?? "");
check("footer drop order preserved @40 (tokens dropped, cwd/ctx/model kept)",
	!f40.includes("↑") && ["~", "ctx", "model-x"].every((s) => f40.includes(s)), `@40: "${f40}"`);

// --- 4. API surface still present (type declarations) ----------------------
const apiNames = ["setFooter", "setHeader", "setWidget", "setEditorComponent", "setWorkingIndicator", "setWorkingMessage", "setHiddenThinkingLabel", "ReadonlyFooterDataProvider"];
const typesDts = `${PI_PKG}/dist/core/extensions/types.d.ts`;
const typesText = readFileSync(typesDts, "utf8");
for (const n of apiNames) {
	check(`API exists: ${n}`, typesText.includes(n));
}
check("API exists: CustomEditor", readFileSync(`${PI_PKG}/dist/modes/interactive/components/custom-editor.d.ts`, "utf8").includes("class CustomEditor"));
const tuiDts = readFileSync(`${PI_TUI}`.replace(/index\.js$/, "index.d.ts"), "utf8");
check("API exists: visibleWidth", /visibleWidth/.test(tuiDts));
check("API exists: truncateToWidth", /truncateToWidth/.test(tuiDts));

console.log("");
if (failures.length === 0) console.log("validate.mjs: ALL CHECKS PASSED");
else console.log(`validate.mjs: ${failures.length} FAILED: ${failures.join(", ")}`);
process.exit(failures.length === 0 ? 0 : 1);
