import { matchesPattern, type Token } from "./tokens.ts";

export interface PartRule {
  part: string;
  /** CSS selector. The first rule that matches an element decides its part. */
  selector: string;
  /** Canonical property to the token patterns it may use. */
  props: Record<string, string[]>;
  /** Properties that must be declared on this part. */
  required?: string[];
}

export interface ComponentDoc {
  name: string;
  part: string;
  summary: string;
  usage: string;
}

export interface Contract {
  /** Tokens the base stylesheet puts on the page itself, e.g. color and background-color. */
  root?: Record<string, string>;
  parts: PartRule[];
  /** Applied to every element, under the part's own entries. */
  any: Record<string, string[]>;
}

export function allowedPatterns(contract: Contract, part: string | null, prop: string): string[] | undefined {
  const own = part ? contract.parts.find((p) => p.part === part)?.props[prop] : undefined;
  return own ?? contract.any[prop];
}

export const isAllowed = (token: Token, patterns: string[]): boolean =>
  patterns.some((p) => matchesPattern(token.name, p));
