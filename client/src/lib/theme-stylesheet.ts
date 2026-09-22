/**
 * Tiny, dependency-free reader for the `:root` block of client/src/index.css.
 * Used ONLY by specs: (a) the guard that keeps THEME_TOKEN_NAMES and the
 * stylesheet in lockstep, (b) the Default-theme fidelity check. Not shipped
 * in the client bundle path (nothing under components/ imports it).
 */

export function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** The body of the first `:root { … }` block (comments removed). */
export function extractRootBlock(css: string): string {
  const match = /:root\s*\{([\s\S]*?)\n\}/.exec(stripCssComments(css));
  if (!match) throw new Error(":root block not found");
  return match[1];
}

/** name -> raw value (trimmed, no trailing semicolon) for every custom property in :root. */
export function parseRootDeclarations(css: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of Array.from(extractRootBlock(css).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g))) {
    out.set(m[1], m[2].trim());
  }
  return out;
}

/** Every `--rb-*` token in :root with `var(--x)` references followed to a literal. */
export function resolveRootTokens(css: string): Record<string, string> {
  const decls = parseRootDeclarations(css);
  const resolve = (name: string, seen: Set<string>): string => {
    const value = decls.get(name);
    if (value === undefined) throw new Error(`undefined token ${name}`);
    const ref = /^var\((--[a-z0-9-]+)\)$/.exec(value);
    if (!ref) return value;
    if (seen.has(name)) throw new Error(`cycle at ${name}`);
    seen.add(name);
    return resolve(ref[1], seen);
  };
  const out: Record<string, string> = {};
  for (const name of Array.from(decls.keys())) {
    if (name.startsWith("--rb-")) out[name] = resolve(name, new Set());
  }
  return out;
}
