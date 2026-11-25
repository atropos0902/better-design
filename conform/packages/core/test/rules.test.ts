import { describe, expect, test } from "vitest";
import {
  addedDecisions, allowedPatterns, canonical, conclude, cssVarFor, effectiveStage, findingKey, isAllowed, isViolation, isWaived, judge,
  keyedHash, lockFor, matchesPattern, newFindings, openBundle, openQuestions, pairedBootstrap, score, settleCauses, sha256, signBundle, toFindings, validateWaivers,
  type Bundle, type Contract, type Decision, type Finding, type Token, type Waiver,
} from "../src/index.ts";

const tok = (name: string): Token => ({ name, type: "dimension", cssVar: cssVarFor("ng", name), values: { a: "1px" } });
const tokens = new Map(["control.height", "space.small", "row.height"].map((n) => [n, tok(n)]));
const contract: Contract = {
  parts: [{ part: "control", selector: "button", props: { height: ["control.height"], gap: ["space.*"] } }],
  any: { gap: ["card.gap"], color: ["*"] },
};
const d = (over: Partial<Decision> = {}): Decision => ({ screen: "s", path: "main>control", part: "control", prop: "height", state: "rest", theme: "a", declared: "40px", trace: { kind: "literal", value: "40px" }, verdict: "literal-value", valueMatch: true, ...over });

describe("patterns", () => {
  test("matching", () => {
    expect(matchesPattern("space.small", "space.*")).toBe(true);
    expect(matchesPattern("spaces.small", "space.*")).toBe(false);
    expect(matchesPattern("space", "space.*")).toBe(false);
    expect(matchesPattern("space.small", "space.small")).toBe(true);
    expect(matchesPattern("space.small", "space")).toBe(false);
    expect(matchesPattern("anything", "*")).toBe(true);
    expect(cssVarFor("ng", "Status.OK / text")).toBe("--ng-status-ok-text");
  });
  test("a part's own entry replaces the general one", () => {
    expect(allowedPatterns(contract, "control", "gap")).toEqual(["space.*"]);
    expect(allowedPatterns(contract, "control", "color")).toEqual(["*"]);
    expect(allowedPatterns(contract, null, "gap")).toEqual(["card.gap"]);
    expect(allowedPatterns(contract, "unknown", "gap")).toEqual(["card.gap"]);
    expect(allowedPatterns(contract, null, "height")).toBeUndefined();
    expect(isAllowed(tok("space.small"), ["x", "space.*"])).toBe(true);
    expect(isAllowed(tok("space.small"), ["x"])).toBe(false);
    expect(isAllowed(tok("space.small"), [])).toBe(false);
  });
});

describe("judge", () => {
  const j = (part: string | null, prop: string, t: Decision["trace"]) => judge(contract, tokens, part, prop, t);
  test("every verdict", () => {
    expect(j("control", "height", { kind: "token", token: "control.height", factor: 1 })).toBe("bound");
    expect(j("control", "height", { kind: "token", token: "row.height", factor: 1 })).toBe("wrong-token");
    expect(j("control", "height", { kind: "token", token: "control.height", factor: 2 })).toBe("derived-token");
    expect(j("control", "height", { kind: "token", token: "row.height", factor: 2 })).toBe("wrong-token");
    expect(j("control", "height", { kind: "token", token: "gone", factor: 1 })).toBe("unresolved");
    expect(j("control", "height", { kind: "literal", value: "40px" })).toBe("literal-value");
    expect(j("control", "height", { kind: "unresolved", reason: "x" })).toBe("unresolved");
    expect(j("control", "height", { kind: "neutral" })).toBeNull();
    expect(j(null, "height", { kind: "literal", value: "40px" })).toBeNull();
  });
  test("what blocks", () => {
    expect((["literal-value", "wrong-token", "derived-token"] as const).every(isViolation)).toBe(true);
    expect(isViolation("unresolved")).toBe(false);
    expect(isViolation("bound")).toBe(false);
  });
});

describe("findings", () => {
  test("themes merge, repeats get an index, bound is dropped", () => {
    const f = toFindings([d(), d({ theme: "b" }), d(), d({ verdict: "bound" }), d({ prop: "gap", verdict: "unresolved", theme: "b" })]);
    expect(f.map((x) => [x.rule, x.prop, x.themes, x.blocking])).toEqual([
      ["literal-value", "height", ["a", "b"], true],
      ["literal-value", "height", ["a"], true],
      ["unresolved", "gap", ["b"], false],
    ]);
    expect(new Set(f.map((x) => x.id)).size).toBe(3);
    expect(f[0]).toEqual({ id: `${findingKey({ rule: "literal-value", screen: "s", path: "main>control", prop: "height", state: "rest", detail: "40px" })}␟0`, rule: "literal-value", screen: "s", path: "main>control", prop: "height", state: "rest", detail: "40px", themes: ["a", "b"], blocking: true });
  });
  test("themes are sorted", () => {
    expect(toFindings([d({ theme: "z" }), d({ theme: "b" })])[0]!.themes).toEqual(["b", "z"]);
  });
  test("the key has no file or line in it, and every field matters", () => {
    const base = { rule: "r", screen: "s", path: "p", prop: "x", state: "rest", detail: "1" };
    for (const k of Object.keys(base) as Array<keyof typeof base>) expect(findingKey({ ...base, [k]: "other" })).not.toBe(findingKey(base));
    expect(findingKey(base).split("␟")).toEqual(["r", "s", "p", "x", "rest", "1"]);
  });
  test("only what the baseline does not hold is new, counted by repeat", () => {
    const base = toFindings([d()]);
    const head = toFindings([d(), d(), d({ prop: "gap" })]);
    expect(newFindings(head, base.map((f) => f.id)).map((f) => f.prop)).toEqual(["height", "gap"]);
  });
  test("a finding caused by an old background is a comment", () => {
    const f = (over: Partial<Finding>): Finding => ({ id: "n", rule: "accessibility", screen: "s", path: "p", prop: "color-contrast", state: "rest", themes: [], blocking: true, detail: "", ...over });
    const old = [findingKey({ rule: "literal-value", screen: "s", path: "card", prop: "background-color", state: "rest", detail: "#fff" })];
    expect(settleCauses([f({ cause: "card" })], old)[0]!.blocking).toBe(false);
    expect(settleCauses([f({ cause: "other" })], old)[0]!.blocking).toBe(true);
    expect(settleCauses([f({ cause: "card", screen: "t" })], old)[0]!.blocking).toBe(true);
    expect(settleCauses([f({})], old)[0]!.blocking).toBe(true);
    const color = [findingKey({ rule: "literal-value", screen: "s", path: "card", prop: "color", state: "rest", detail: "#fff" })];
    expect(settleCauses([f({ cause: "card" })], color)[0]!.blocking).toBe(true);
  });
});

describe("waivers", () => {
  const w: Waiver = { rule: "literal-value", screen: "s", path: "main>control", prop: "height", owner: "o", reason: "r" };
  test("need every field", () => {
    expect(validateWaivers([w])).toEqual([w]);
    expect(validateWaivers([])).toEqual([]);
    expect(() => validateWaivers({})).toThrow("must be a list");
    for (const k of Object.keys(w)) {
      expect(() => validateWaivers([w, { ...w, [k]: " " }])).toThrow(`waiver 1: ${k} is required`);
      expect(() => validateWaivers([{ ...w, [k]: 3 }])).toThrow(`waiver 0: ${k} is required`);
    }
  });
  test("cover one place only", () => {
    const f = toFindings([d()])[0]!;
    expect(isWaived(f, [w])).toBe(true);
    expect(isWaived(f, [])).toBe(false);
    for (const k of ["rule", "screen", "path", "prop"] as const) expect(isWaived(f, [{ ...w, [k]: "x" }])).toBe(false);
  });
  test("the third waiver of a rule opens a question", () => {
    expect(openQuestions([w, w])).toEqual([]);
    expect(openQuestions([w, w, w, { ...w, prop: "gap" }])).toEqual([{ rule: "literal-value", prop: "height", count: 3 }]);
    expect(openQuestions([w], 1)).toEqual([{ rule: "literal-value", prop: "height", count: 1 }]);
  });
});

describe("score", () => {
  test("bound in every theme or not bound; value is counted beside it", () => {
    const s = score([
      d({ verdict: "bound" }), d({ verdict: "bound", theme: "b" }),
      d({ prop: "gap", verdict: "bound" }), d({ prop: "gap", theme: "b" }),
      d({ prop: "color", verdict: "unresolved", valueMatch: false }),
    ]);
    expect(s).toEqual({ decisions: 3, bound: 1, unresolved: 1, valueMatches: 2, binding: 1 / 3, value: 2 / 3 });
  });
  test("the example in the brief: 44 of 50 by value, 31 of 50 by binding", () => {
    const list = Array.from({ length: 50 }, (_, i) => d({ path: `p${i}`, verdict: i < 31 ? "bound" : "literal-value", valueMatch: i < 44 }));
    const s = score(list);
    expect([s.value, s.binding]).toEqual([0.88, 0.62]);
  });
  test("two decisions in the same place count twice, and states are separate", () => {
    expect(score([d(), d()]).decisions).toBe(2);
    expect(score([d(), d({ state: "hover" })]).decisions).toBe(2);
    expect(score([d(), d({ theme: "b" })]).decisions).toBe(1);
    expect(score([d(), d({ screen: "t" }), d({ path: "q" })]).decisions).toBe(3);
  });
  test("nothing to decide scores 1", () => {
    expect(score([])).toEqual({ decisions: 0, bound: 0, unresolved: 0, valueMatches: 0, binding: 1, value: 1 });
  });
  test("a pull request is scored on what it added", () => {
    expect(addedDecisions([d()], [d(), d()])).toHaveLength(1);
    expect(addedDecisions([d(), d()], [d(), d()])).toHaveLength(0);
    for (const k of ["screen", "path", "prop", "state", "theme", "declared"] as const) expect(addedDecisions([d()], [d({ [k]: "x" })])).toHaveLength(1);
    expect(addedDecisions([], [d()])).toHaveLength(1);
  });
});

describe("pairedBootstrap", () => {
  test("is seeded and brackets the mean", () => {
    const diffs = [0.1, 0.2, 0.3, 0.25, 0.15];
    const r = pairedBootstrap(diffs, 2000);
    expect(r).toEqual(pairedBootstrap(diffs, 2000));
    expect(r.mean).toBeCloseTo(0.2);
    expect(r.tasks).toBe(5);
    expect(r.low).toBeGreaterThanOrEqual(0.1);
    expect(r.low).toBeLessThan(r.mean);
    expect(r.high).toBeGreaterThan(r.mean);
    expect(r.high).toBeLessThanOrEqual(0.3);
  });
  test("covers about the right width on a known spread", () => {
    // 40 values with sd 1: the standard error is 1/sqrt(40), so the 95% interval is about 0.62 wide.
    const diffs = Array.from({ length: 40 }, (_, i) => (i % 2 ? 1 : -1));
    const r = pairedBootstrap(diffs, 4000);
    expect(r.high - r.low).toBeGreaterThan(0.5);
    expect(r.high - r.low).toBeLessThan(0.75);
  });
  test("identical tasks have no width, and no tasks is an error", () => {
    expect(pairedBootstrap([0.2, 0.2], 100)).toEqual({ mean: 0.2, low: 0.2, high: 0.2, tasks: 2 });
    expect(() => pairedBootstrap([])).toThrow("no tasks");
  });
});

describe("bundle", async () => {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const priv = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const keys = { k1: await crypto.subtle.exportKey("jwk", pair.publicKey) };
  const bundle: Bundle = { id: "n", version: "1", themes: ["a"], tokens: [tok("space.small")], contract, components: [] };
  const signed = await signBundle(bundle, "k1", priv);
  const lock = await lockFor(signed);
  test("opens when signature, key and lock agree", async () => {
    expect(await openBundle(signed, lock, keys)).toEqual(bundle);
  });
  test("refuses everything else", async () => {
    const tampered = { ...signed, bundle: { ...bundle, contract: { ...contract, any: {} } } };
    await expect(openBundle(tampered, await lockFor(tampered), keys)).rejects.toThrow("signature does not verify");
    await expect(openBundle(signed, { ...lock, sha256: "0" }, keys)).rejects.toThrow("does not match the lockfile");
    await expect(openBundle(signed, { ...lock, id: "x" }, keys)).rejects.toThrow("does not match the lockfile");
    await expect(openBundle(signed, { ...lock, version: "2" }, keys)).rejects.toThrow("n@1 does not match the lockfile (n@2)");
    await expect(openBundle(signed, { ...lock, keyId: "k2" }, keys)).rejects.toThrow("lockfile expects key k2");
    await expect(openBundle({ ...signed, keyId: "k9" }, lock, keys)).rejects.toThrow("unknown key k9");
  });
  test("canonical JSON ignores key order and undefined", () => {
    expect(canonical({ b: [1, { d: 1, c: "x" }], a: null })).toBe('{"a":null,"b":[1,{"c":"x","d":1}]}');
    expect(canonical({ a: undefined, b: 1 })).toBe('{"b":1}');
  });
  test("hashes", async () => {
    expect(await sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(await keyedHash("k", "a")).not.toBe(await keyedHash("j", "a"));
    expect(await keyedHash("k", "a")).toBe(await keyedHash("k", "a"));
    expect(await keyedHash("key", "The quick brown fox jumps over the lazy dog")).toBe("f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8");
  });
});

describe("gate", () => {
  const f = toFindings([d()]);
  const soft = toFindings([d({ verdict: "unresolved" })]);
  const at = (stage: "silent" | "comments" | "required", killSwitch = false, reachable = true) => ({ stage, killSwitch, reachable });
  test("stages", () => {
    expect(conclude(at("required"), f)).toEqual({ conclusion: "failure", comment: true });
    expect(conclude(at("required"), soft)).toEqual({ conclusion: "success", comment: true });
    expect(conclude(at("required"), [])).toEqual({ conclusion: "success", comment: false });
    expect(conclude(at("required"), [...soft, ...f])).toEqual({ conclusion: "failure", comment: true });
    expect(conclude(at("comments"), f)).toEqual({ conclusion: "neutral", comment: true });
    expect(conclude(at("comments"), [])).toEqual({ conclusion: "neutral", comment: false });
    expect(conclude(at("silent"), f)).toEqual({ conclusion: "neutral", comment: false });
  });
  test("the kill switch and an outage both drop to comments, and never wake a silent repository", () => {
    expect(effectiveStage(at("required", true))).toBe("comments");
    expect(effectiveStage(at("required", false, false))).toBe("comments");
    expect(effectiveStage(at("required"))).toBe("required");
    expect(effectiveStage(at("comments"))).toBe("comments");
    expect(effectiveStage(at("silent", true, false))).toBe("silent");
    expect(conclude(at("required", true), f)).toEqual({ conclusion: "neutral", comment: true });
    expect(conclude(at("required", false, false), f)).toEqual({ conclusion: "neutral", comment: true });
  });
});
