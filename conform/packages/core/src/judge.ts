import { allowedPatterns, isAllowed, type Contract } from "./contract.ts";
import type { Token } from "./tokens.ts";
import type { Trace } from "./trace.ts";

export type Verdict = "bound" | "literal-value" | "wrong-token" | "derived-token" | "unresolved";

export interface Decision {
  screen: string;
  /** Path of parts and landmarks from the screen root. Not line numbers, not file names. */
  path: string;
  part: string | null;
  prop: string;
  /** The physical property behind `prop`, when one axis covers two sides. */
  longhand?: string;
  state: "rest" | "hover" | "focus";
  theme: string;
  /** The declaration as written. Stays on the customer's runner. */
  declared: string;
  trace: Trace;
  verdict: Verdict;
  /** Does the computed value equal any token's value? Reported, never gated. */
  valueMatch: boolean;
}

/**
 * Decide one traced declaration against the contract.
 * null means there is nothing to decide: neutral value, or a property the contract does not cover.
 */
export function judge(
  contract: Contract,
  tokens: Map<string, Token>,
  part: string | null,
  prop: string,
  t: Trace,
): Verdict | null {
  const patterns = allowedPatterns(contract, part, prop);
  if (!patterns || t.kind === "neutral") return null;
  if (t.kind === "unresolved") return "unresolved";
  if (t.kind === "literal") return "literal-value";
  const token = tokens.get(t.token);
  if (!token) return "unresolved";
  if (!isAllowed(token, patterns)) return "wrong-token";
  return t.factor === 1 ? "bound" : "derived-token";
}

/** Findings that can fail a pull request. Unresolved is reported and never counted as a pass. */
export const isViolation = (v: Verdict): boolean => v === "literal-value" || v === "wrong-token" || v === "derived-token";
