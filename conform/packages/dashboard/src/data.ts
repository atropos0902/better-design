export type Stage = "silent" | "comments" | "required";
export interface RepoRow { id: number; repo: string; stage: Stage; reviews: number; decisions: number; bound: number; valueMatches: number; unresolved: number }
export interface DashboardData {
  customer: string;
  killSwitch: boolean;
  admin: boolean;
  repos: RepoRow[];
  rules: Array<{ rule: string; count: number }>;
  waivers: Array<{ rule: string; prop: string; count: number; question: boolean }>;
}

export const RULE_NAMES: Record<string, string> = {
  "literal-value": "Value with no token behind it",
  "wrong-token": "Token not allowed on this part",
  "derived-token": "Token scaled by a factor",
  "token-redefined": "Design system variable overridden",
  accessibility: "Accessibility",
  unresolved: "Couldn't be traced",
};

export const percent = (a: number, b: number): string => (b === 0 ? "–" : `${Math.round((a / b) * 100)}%`);
/** How much the value check flatters a repository, in points. */
export const gap = (r: RepoRow): string => (r.decisions === 0 ? "–" : `${Math.round(((r.valueMatches - r.bound) / r.decisions) * 100)} pts`);
