import { describe, expect, test } from "vitest";
import { trace, type Scope } from "../src/index.ts";

/** Scopes as a list, nearest first, the way the checker sees an element and its ancestors. */
function scopeOf(levels: Array<Record<string, string>>, tokens: Record<string, string> = { "--t": "space.small", "--u": "space.large", "--c": "text.muted" }): Scope<number> {
  return {
    lookup: (name, at) => {
      for (let i = at; i < levels.length; i++) if (levels[i]![name] !== undefined) return { value: levels[i]![name]!, at: i };
      return undefined;
    },
    token: (v) => tokens[v],
  };
}
const base = { "--t": "8px", "--u": "24px", "--c": "#555" };
const t = (text: string, ...levels: Array<Record<string, string>>) => trace(text, 0, scopeOf([...levels, base]));

describe("tokens", () => {
  test("direct, aliased and deep aliases", () => {
    expect(t("var(--t)")).toEqual({ kind: "token", token: "space.small", factor: 1 });
    expect(t("var( --t )")).toEqual({ kind: "token", token: "space.small", factor: 1 });
    expect(t("var(--a)", { "--a": "var(--b)", "--b": "var(--t)" })).toEqual({ kind: "token", token: "space.small", factor: 1 });
    expect(t("var(--t) !important")).toEqual({ kind: "token", token: "space.small", factor: 1 });
  });
  test("an alias resolves where it was declared", () => {
    // --a is set on the parent as var(--x); the child's own --x must not change it.
    expect(t("var(--a)", { "--x": "1px" }, { "--a": "var(--x)", "--x": "var(--t)" })).toEqual({ kind: "token", token: "space.small", factor: 1 });
  });
  test("the nearest declaration wins", () => {
    expect(t("var(--a)", { "--a": "3px" }, { "--a": "var(--t)" })).toEqual({ kind: "literal", value: "3px" });
  });
  test("fallbacks", () => {
    expect(t("var(--none, var(--t))")).toEqual({ kind: "token", token: "space.small", factor: 1 });
    expect(t("var(--none, 4px)")).toEqual({ kind: "literal", value: "4px" });
    expect(t("var(--none,)")).toEqual({ kind: "neutral" });
    expect(t("var(--t, 4px)")).toEqual({ kind: "token", token: "space.small", factor: 1 });
    expect(t("var(--none)")).toEqual({ kind: "unresolved", reason: "--none is not defined" });
    expect(t("var(--i, 2px)", { "--i": "initial" })).toEqual({ kind: "literal", value: "2px" });
    expect(t("var(--i, 2px)", { "--i": " initial " })).toEqual({ kind: "literal", value: "2px" });
  });
  test("a token's variable that is not defined is not a token", () => {
    expect(trace("var(--t)", 0, scopeOf([{}]))).toEqual({ kind: "unresolved", reason: "--t is not defined" });
  });
});

describe("calc", () => {
  test("unitless factors keep the token and the factor", () => {
    expect(t("calc(var(--t) * 2)")).toEqual({ kind: "token", token: "space.small", factor: 2 });
    expect(t("calc(0.5 * var(--t))")).toEqual({ kind: "token", token: "space.small", factor: 0.5 });
    expect(t("calc(var(--t) / 4)")).toEqual({ kind: "token", token: "space.small", factor: 0.25 });
    expect(t("calc(var(--a) * 2)", { "--a": "calc(var(--t) * 3)" })).toEqual({ kind: "token", token: "space.small", factor: 6 });
    expect(t("calc(var(--a) / 2)", { "--a": "calc(var(--t) * 3)" })).toEqual({ kind: "token", token: "space.small", factor: 1.5 });
    expect(t("calc(var(--t) * -1)")).toEqual({ kind: "token", token: "space.small", factor: -1 });
    expect(t("calc(var(--t)*2)")).toEqual({ kind: "token", token: "space.small", factor: 2 });
  });
  test("zero is neutral, division by zero and bad numbers are not traced", () => {
    expect(t("calc(var(--t) * 0)")).toEqual({ kind: "neutral" });
    expect(t("calc(var(--t) * 1.2.3)")).toEqual({ kind: "unresolved", reason: "calc() factor" });
  });
  test("literals", () => {
    expect(t("calc(1px + 2px)")).toEqual({ kind: "literal", value: "calc(1px + 2px)" });
    expect(t("calc(var(--s) * 10)", { "--s": ".25rem" })).toEqual({ kind: "literal", value: "calc(var(--s) * 10)" });
    expect(t("calc(var(--s) + 1px)", { "--s": ".25rem" })).toEqual({ kind: "literal", value: "calc(var(--s) + 1px)" });
    expect(t("calc(var(--s) + var(--r))", { "--s": "1px", "--r": "2px" })).toEqual({ kind: "literal", value: "calc(var(--s) + var(--r))" });
  });
  test("mixtures are unresolved, never a pass", () => {
    expect(t("calc(var(--t) + 1px)")).toEqual({ kind: "unresolved", reason: "calc() mixes values" });
    expect(t("calc(var(--t) + var(--u))")).toEqual({ kind: "unresolved", reason: "calc() mixes values" });
    expect(t("calc(var(--t) * var(--n))", { "--n": "2" })).toEqual({ kind: "unresolved", reason: "calc() mixes values" });
    expect(t("calc(var(--none) + 1px)")).toEqual({ kind: "unresolved", reason: "calc() mixes values" });
    expect(t("calc(var(--none) * 2)")).toEqual({ kind: "unresolved", reason: "--none is not defined" });
    expect(t("calc(2 / var(--t))")).toEqual({ kind: "unresolved", reason: "calc() mixes values" });
  });
});

describe("lists and functions", () => {
  const shadow = { "--off": "0 0 #0000", "--s": "var(--t)", "--lit": "0 1px 2px red" };
  test("null layers drop out of a layered value", () => {
    expect(t("var(--off), var(--s)", shadow)).toEqual({ kind: "token", token: "space.small", factor: 1 });
    expect(t("var(--off), var(--off)", shadow)).toEqual({ kind: "neutral" });
    expect(t("var(--off), var(--lit)", shadow)).toEqual({ kind: "literal", value: "0 1px 2px red" });
    expect(t("var(--s), var(--lit)", shadow)).toEqual({ kind: "unresolved", reason: "value mixes tokens and literals" });
    expect(t("0 1px var(--k), 0 2px var(--k)", { "--k": "red" })).toEqual({ kind: "literal", value: "0 1px var(--k), 0 2px var(--k)" });
  });
  test("a value built from literals only is a literal", () => {
    expect(t("0 1px 2px var(--k, rgb(0 0 0 / 0.1))")).toEqual({ kind: "literal", value: "0 1px 2px var(--k, rgb(0 0 0 / 0.1))" });
    expect(t("0 1px 2px var(--c)")).toEqual({ kind: "unresolved", reason: "value mixes tokens and literals" });
    expect(t("0 1px var(--k) var(--c)", { "--k": "red" })).toEqual({ kind: "unresolved", reason: "value mixes tokens and literals" });
    expect(t("0 1px var(--k) var(--z)", { "--k": "red", "--z": "0" })).toEqual({ kind: "literal", value: "0 1px var(--k) var(--z)" });
  });
  test("color functions", () => {
    expect(t("rgb(1 2 3)")).toEqual({ kind: "literal", value: "rgb(1 2 3)" });
    expect(t("color-mix(in oklab, var(--c) 50%, transparent)")).toEqual({ kind: "unresolved", reason: "color-mix() mixes values" });
    expect(t("light-dark(var(--c), var(--c))")).toEqual({ kind: "token", token: "text.muted", factor: 1 });
    expect(t("light-dark(var(--c), var(--t))")).toEqual({ kind: "unresolved", reason: "light-dark() arms differ" });
    expect(t("light-dark(var(--c), red)")).toEqual({ kind: "unresolved", reason: "light-dark() arms differ" });
    expect(t("light-dark(red, var(--c))")).toEqual({ kind: "unresolved", reason: "light-dark() arms differ" });
    expect(t("light-dark(calc(var(--t) * 2), var(--t))")).toEqual({ kind: "unresolved", reason: "light-dark() arms differ" });
    expect(t("light-dark(red, blue)")).toEqual({ kind: "literal", value: "light-dark(red, blue)" });
    expect(t("light-dark(transparent, inherit)")).toEqual({ kind: "neutral" });
    expect(t("light-dark()")).toEqual({ kind: "unresolved", reason: "empty light-dark()" });
  });
});

describe("guards", () => {
  test("cycles and empty values are unresolved", () => {
    expect(t("var(--a)", { "--a": "var(--b)", "--b": "var(--a)" })).toEqual({ kind: "unresolved", reason: "variable cycle" });
    expect(t("")).toEqual({ kind: "unresolved", reason: "empty value" });
    expect(t("  !important")).toEqual({ kind: "unresolved", reason: "empty value" });
  });
  test("cycles through calc, fallbacks, layers and light-dark end too", () => {
    const end = { kind: "unresolved" };
    expect(t("var(--a)", { "--a": "calc(var(--a) * 2)" })).toMatchObject(end);
    expect(t("var(--none, var(--a))", { "--a": "var(--none, var(--a))" })).toMatchObject(end);
    expect(t("var(--a)", { "--a": "var(--a), var(--t)" })).toMatchObject(end);
    expect(t("var(--a)", { "--a": "light-dark(var(--a), var(--a))" })).toMatchObject(end);
    expect(t("var(--a)", { "--a": "1px var(--a)" })).toMatchObject(end);
  });
  test("light-dark with one arm neutral is not a token", () => {
    expect(t("light-dark(transparent, var(--c))")).toMatchObject({ kind: "unresolved" });
    expect(t("light-dark(var(--c), transparent)")).toMatchObject({ kind: "unresolved" });
    expect(t("light-dark(red, transparent)")).toMatchObject({ kind: "unresolved" });
  });
  test("a long chain is followed to its limit and no further", () => {
    const chain = (n: number): Record<string, string> => Object.fromEntries(Array.from({ length: n }, (_, i) => [`--v${i}`, i === n - 1 ? "var(--t)" : `var(--v${i + 1})`]));
    expect(t("var(--v0)", chain(16))).toEqual({ kind: "token", token: "space.small", factor: 1 });
    expect(t("var(--v0)", chain(17))).toEqual({ kind: "unresolved", reason: "variable cycle" });
  });
  test("neutral", () => {
    expect(t("inherit")).toEqual({ kind: "neutral" });
    expect(t("var(--z)", { "--z": "0px" })).toEqual({ kind: "neutral" });
  });
});
