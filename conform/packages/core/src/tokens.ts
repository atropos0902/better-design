export type TokenType = "color" | "dimension" | "number" | "fontWeight" | "shadow";

export interface Token {
  name: string;
  type: TokenType;
  cssVar: string;
  /** Resolved value per theme id. */
  values: Record<string, string>;
  description?: string;
}

/** Turns a customer's token files into tokens. Adapters live with the customer, not here. */
export interface TokenAdapter {
  load(dir: string): Promise<{ themes: string[]; tokens: Token[] }>;
}

export const cssVarFor = (prefix: string, name: string): string =>
  `--${prefix}-${name.replace(/[.\s/]+/g, "-").toLowerCase()}`;

/** `space.*` matches every token under space. Anything else must match exactly. */
export function matchesPattern(name: string, pattern: string): boolean {
  if (pattern === "*") return true;
  if (pattern.endsWith(".*")) return name.startsWith(pattern.slice(0, -1));
  return name === pattern;
}
