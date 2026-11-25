import type { Finding } from "./findings.ts";

export type Stage = "silent" | "comments" | "required";
export type Conclusion = "success" | "failure" | "neutral";

export interface GateState { stage: Stage; killSwitch: boolean; reachable: boolean }

/** The kill switch and an unreachable service both mean comments. An outage here must not stop a merge. */
export function effectiveStage(s: GateState): Stage {
  if (s.stage === "silent") return "silent";
  if (s.killSwitch || !s.reachable) return "comments";
  return s.stage;
}

export function conclude(s: GateState, fresh: Finding[]): { conclusion: Conclusion; comment: boolean } {
  const stage = effectiveStage(s);
  const blocking = fresh.some((f) => f.blocking);
  if (stage === "silent") return { conclusion: "neutral", comment: false };
  if (stage === "comments") return { conclusion: "neutral", comment: fresh.length > 0 };
  return { conclusion: blocking ? "failure" : "success", comment: fresh.length > 0 };
}
