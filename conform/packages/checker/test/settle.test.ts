import { describe, expect, test } from "vitest";
import { settle } from "../src/inspect.ts";

const tok = (factor = 1) => ({ kind: "token", token: "space.small", factor }) as const;
const lit = { kind: "literal", value: "8px" } as const;
const none = (): null => null;

describe("settle: the probe decides", () => {
  test("agreement keeps the trace", () => {
    const t = tok();
    expect(settle(t, "var(--a)", "137px", true, "space.small", none)).toBe(t);
    expect(settle(lit, "8px", "8px", false, null, none)).toBe(lit);
  });
  test("the token that moved it replaces a wrong answer", () => {
    expect(settle(lit, "8px", "137px", true, "space.small", none)).toEqual(tok());
    expect(settle({ kind: "neutral" }, "var(--a)", "137px", true, "space.small", none)).toEqual(tok());
    expect(settle({ kind: "unresolved", reason: "x" }, "var(--a)", "137px", true, "space.small", none)).toEqual(tok());
    expect(settle({ kind: "token", token: "other", factor: 1 }, "var(--a)", "137px", true, "space.small", none)).toEqual(tok());
  });
  test("a token trace that moves nothing is a literal, or neutral when the result is", () => {
    expect(settle(tok(), "var(--a)", "8px", false, null, none)).toEqual({ kind: "literal", value: "var(--a)" });
    expect(settle(tok(), "var(--a)", "none", false, null, none)).toEqual({ kind: "neutral" });
    expect(settle({ kind: "unresolved", reason: "x" }, "0", "0px", false, null, none)).toEqual({ kind: "neutral" });
  });
  test("a factor has to be the factor that was measured", () => {
    const t = tok(2);
    expect(settle(t, "calc(var(--a) * 2)", "16px", true, null, () => 2)).toBe(t);
    expect(settle(t, "calc(var(--a) * 2)", "16px", true, null, () => 3).kind).toBe("unresolved");
    expect(settle(tok(), "var(--a)", "9px", true, null, () => 1).kind).toBe("unresolved");
    expect(settle(t, "calc(var(--a) * 2)", "red", true, null, none).kind).toBe("unresolved");
  });
  test("movement nobody can name is unresolved, never a pass", () => {
    expect(settle(lit, "8px", "9px", true, null, none).kind).toBe("unresolved");
    expect(settle({ kind: "neutral" }, "var(--a)", "9px", true, null, none).kind).toBe("unresolved");
    const u = { kind: "unresolved", reason: "x" } as const;
    expect(settle(u, "calc(var(--a) + 1px)", "9px", true, null, none)).toBe(u);
  });
  test("min, max and clamp are never named from the probe", () => {
    const m = { kind: "unresolved", reason: "max() mixes values" } as const;
    expect(settle(m, "max(12px, var(--a))", "137px", true, "space.small", none)).toBe(m);
    expect(settle(m, "max(12px, var(--a))", "12px", false, null, none)).toBe(m);
  });
  test("font-relative literals stay literals", () => {
    const em = { kind: "literal", value: "1em" } as const;
    expect(settle(em, "1em", "137px", true, null, none)).toBe(em);
    expect(settle(em, "1em", "137px", true, "type.body", none)).toBe(em);
    expect(settle({ kind: "literal", value: "x" }, "calc(var(--a) * 1em)", "9px", true, null, none).kind).toBe("unresolved");
  });
});
