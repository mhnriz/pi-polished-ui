/**
 * polished-ui — shared display helpers used by footer.ts and header.ts.
 * Pure string/width helpers only: no state, no components.
 */

export const MIDDOT = "·";
export const COLLAPSE_GLYPH = "…";

// Type-only ambient for the host process; at runtime node globals exist.
declare const process: { env: Record<string, string | undefined> };

function normalizeSlashes(p: string): string {
	return p.replace(/\\/g, "/");
}

export function homeDir(): string | undefined {
	return process.env.HOME || process.env.USERPROFILE;
}

/** Mirrors footer.js sanitizeStatusText() (single-line statuses). */
export function sanitizeStatusText(text: string): string {
	return text.replace(/[\r\n\t]/g, " ").replace(/ +/g, " ").trim();
}

/** Home-relative form, e.g. /home/user/project → ~/project, home → ~. */
export function withTilde(cwd: string): string {
	const home = homeDir();
	if (home) {
		const normalizedCwd = normalizeSlashes(cwd);
		const normalizedHome = normalizeSlashes(home);
		if (normalizedCwd === normalizedHome) return "~";
		if (normalizedCwd.startsWith(`${normalizedHome}/`)) {
			return `~${normalizedCwd.slice(normalizedHome.length)}`;
		}
	}
	return normalizeSlashes(cwd);
}

/**
 * Progressive cwd-shortening variants, longest first:
 *   [~/a/b/c/project, ~/a/…/project, project]
 */
export function shortenCwdVariants(cwd: string): string[] {
	const tilde = withTilde(cwd);
	const segments = tilde.split("/").filter(Boolean);
	const variants: string[] = [tilde];
	const leaf = segments[segments.length - 1] ?? tilde;
	if (segments.length > 2) {
		const head = tilde.startsWith("~") ? "~" : segments[0] ?? "";
		variants.push(`${head}/${COLLAPSE_GLYPH}/${leaf}`);
	}
	if (segments.length > 1 && leaf !== tilde) {
		variants.push(leaf);
	}
	return [...new Set(variants)];
}
