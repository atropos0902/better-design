import { describe, expect, test } from "vitest";
import { asCall, axisOf, expand, isNeutral, physicalSide, splitTop, stripImportant } from "../src/index.ts";

describe("splitTop", () => {
  test("ignores separators inside parentheses and quotes", () => {
    expect(splitTop("var(--a, 1px), b", ",")).toEqual(["var(--a, 1px)", "b"]);
    expect(splitTop("calc(1px + 2px)  var(--b)", " ")).toEqual(["calc(1px + 2px)", "var(--b)"]);
    expect(splitTop(`"a, b", 'c,d',e`, ",")).toEqual(['"a, b"', "'c,d'", "e"]);
    expect(splitTop("1px / 2px", "/")).toEqual(["1px", "2px"]);
    expect(splitTop("a,,b,", ",")).toEqual(["a", "b"]);
    expect(splitTop("", ",")).toEqual([]);
    expect(splitTop("a\tb\nc", " ")).toEqual(["a", "b", "c"]);
    expect(splitTop(`"a)" b`, " ")).toEqual([`"a)"`, "b"]);
  });
});

describe("asCall", () => {
  test("only when the whole text is one call", () => {
    expect(asCall("var(--a)")).toEqual({ name: "var", args: "--a" });
    expect(asCall("CALC(1px + (2px))")).toEqual({ name: "calc", args: "1px + (2px)" });
    expect(asCall("-webkit-calc(1px)")).toEqual({ name: "-webkit-calc", args: "1px" });
    expect(asCall("var(--a) var(--b)")).toBeNull();
    expect(asCall("var(--a), var(--b)")).toBeNull();
    expect(asCall("var(--a")).toBeNull();
    expect(asCall("1px")).toBeNull();
    expect(asCall("x var(--a)")).toBeNull();
    expect(asCall("calc((1px)")).toBeNull();
  });
});

describe("isNeutral", () => {
  test.each(["inherit", "INITIAL", " auto ", "0", "0px", "-0", "+0.0", "0.00rem", "50%", "100vh", "1fr", "100dvh", "12.5%", "transparent", "currentColor", "0 0 #0000", "none", "bolder", "-50%", ".0px", "rgba(0, 0, 0, 0)", "stretch", "fit-content", "0 0 0 0 #0000", "#0000", "#00000000", "unset", "revert", "revert-layer", "normal", "min-content", "max-content", "lighter", "smaller", "larger", "10vw", "10svh"])("%s is neutral", (v) => expect(isNeutral(v)).toBe(true));
  test.each(["1px", "0.5px", "10px", "#000", "var(--a)", "1em", "100vmin", "0px 1px", "calc(0px)", "a50%", "50%x", "x0", "red", "x1fr", ""])("%s is not neutral", (v) => expect(isNeutral(v)).toBe(false));
});

test("stripImportant", () => {
  expect(stripImportant("1px !important")).toBe("1px");
  expect(stripImportant("1px!IMPORTANT ")).toBe("1px");
  expect(stripImportant(" 1px ")).toBe("1px");
  expect(stripImportant("!important 1px")).toBe("!important 1px");
});

describe("expand", () => {
  test.each<[string, string, Array<[string, string | null]>]>([
    ["padding", "1px", [["padding-top", "1px"], ["padding-right", "1px"], ["padding-bottom", "1px"], ["padding-left", "1px"]]],
    ["padding", "1px 2px", [["padding-top", "1px"], ["padding-right", "2px"], ["padding-bottom", "1px"], ["padding-left", "2px"]]],
    ["margin", "1px 2px 3px", [["margin-top", "1px"], ["margin-right", "2px"], ["margin-bottom", "3px"], ["margin-left", "2px"]]],
    ["padding", "1px 2px 3px 4px", [["padding-top", "1px"], ["padding-right", "2px"], ["padding-bottom", "3px"], ["padding-left", "4px"]]],
    ["padding", "1px 2px 3px 4px 5px", [["padding-top", null], ["padding-right", null], ["padding-bottom", null], ["padding-left", null]]],
    ["padding-inline", "1px", [["padding-left", "1px"], ["padding-right", "1px"]]],
    ["padding-inline", "1px 2px", [["padding-left", "1px"], ["padding-right", "2px"]]],
    ["margin-block", "1px 2px", [["margin-top", "1px"], ["margin-bottom", "2px"]]],
    ["padding-inline-start", "1px", [["padding-left", "1px"]]],
    ["padding-inline-end", "1px", [["padding-right", "1px"]]],
    ["margin-block-start", "1px", [["margin-top", "1px"]]],
    ["margin-block-end", "1px", [["margin-bottom", "1px"]]],
    ["padding-left", "1px !important", [["padding-left", "1px"]]],
    ["PADDING-TOP", "1px", [["padding-top", "1px"]]],
    ["height", "1px", [["height", "1px"]]],
    ["block-size", "1px", [["height", "1px"]]],
    ["min-height", "1px", [["min-height", "1px"]]],
    ["min-block-size", "1px", [["min-height", "1px"]]],
    ["gap", "1px", [["row-gap", "1px"], ["column-gap", "1px"]]],
    ["gap", "1px 2px", [["row-gap", "1px"], ["column-gap", "2px"]]],
    ["row-gap", "1px", [["row-gap", "1px"]]],
    ["column-gap", "1px", [["column-gap", "1px"]]],
    ["color", "red", [["color", "red"]]],
    ["background-color", "red", [["background-color", "red"]]],
    ["font-size", "1px", [["font-size", "1px"]]],
    ["font-weight", "1", [["font-weight", "1"]]],
    ["box-shadow", "none", [["box-shadow", "none"]]],
    ["background", "var(--a)", [["background-color", "var(--a)"]]],
    ["background", "url(x.png)", [["background-color", null]]],
    ["background", "linear-gradient(red, blue)", [["background-color", null]]],
    ["background", "radial-gradient(red, blue)", [["background-color", null]]],
    ["background", "conic-gradient(red, blue)", [["background-color", null]]],
    ["background", "var(--a) no-repeat", [["background-color", "var(--a)"]]],
    ["background", "no-repeat #fff", [["background-color", "#fff"]]],
    ["background", "no-repeat center", [["background-color", null]]],
    ["background", "#fff url(x.png)", [["background-color", null]]],
    ["border-color", "red", [["border-color", "red"]]],
    ["border-color", "red blue", [["border-color", null]]],
    ["border-top-color", "red", [["border-color", "red"]]],
    ["border", "1px solid var(--a)", [["border-color", "var(--a)"]]],
    ["border-top", "1px solid red", [["border-color", "red"]]],
    ["border", "0 solid", [["border-color", "currentcolor"]]],
    ["border", "thin dashed", [["border-color", "currentcolor"]]],
    ["border", "medium none", [["border-color", "currentcolor"]]],
    ["border", "var(--w) solid var(--c)", [["border-color", null]]],
    ["border-radius", "1px", [["border-radius", "1px"]]],
    ["border-radius", "1px 1px", [["border-radius", "1px"]]],
    ["border-radius", "1px 2px", [["border-radius", null]]],
    ["border-radius", "1px / 2px", [["border-radius", null]]],
    ["border-top-left-radius", "1px", [["border-radius", "1px"]]],
    ["border-start-start-radius", "1px", [["border-radius", "1px"]]],
    ["border-start-end-radius", "1px", []],
    ["border-end-start-radius", "1px", []],
    ["border-end-end-radius", "1px", []],
    ["grid-gap", "1px 2px", [["row-gap", "1px"], ["column-gap", "2px"]]],
    ["grid-row-gap", "1px", [["row-gap", "1px"]]],
    ["grid-column-gap", "1px", [["column-gap", "1px"]]],
    ["font", "inherit", [["font-size", "inherit"], ["font-weight", "inherit"]]],
    ["font", "revert-layer", [["font-size", "revert-layer"], ["font-weight", "revert-layer"]]],
    ["font", "1px x", [["font-size", null], ["font-weight", null]]],
    ["display", "flex", []],
    ["scroll-padding", "1px", []],
    ["padding-x", "1px", []],
  ])("%s: %s", (p, v, out) => expect(expand(p, v)).toEqual(out));
});

describe("writing mode and direction", () => {
  const rtl = { vertical: false, blockReversed: false, inlineReversed: true };
  const vrl = { vertical: true, blockReversed: true, inlineReversed: false };
  const vlr = { vertical: true, blockReversed: false, inlineReversed: false };
  test("logical sides land where the browser puts them", () => {
    expect(["inline-start", "inline-end", "block-start", "block-end"].map((s) => physicalSide(s))).toEqual(["left", "right", "top", "bottom"]);
    expect(["inline-start", "inline-end", "block-start", "block-end"].map((s) => physicalSide(s, rtl))).toEqual(["right", "left", "top", "bottom"]);
    expect(["inline-start", "inline-end", "block-start", "block-end"].map((s) => physicalSide(s, vrl))).toEqual(["top", "bottom", "right", "left"]);
    expect(["inline-start", "inline-end", "block-start", "block-end"].map((s) => physicalSide(s, vlr))).toEqual(["top", "bottom", "left", "right"]);
  });
  test("expand follows them", () => {
    expect(expand("padding-inline", "1px 2px", rtl)).toEqual([["padding-right", "1px"], ["padding-left", "2px"]]);
    expect(expand("margin-block-end", "1px", vrl)).toEqual([["margin-left", "1px"]]);
    expect(expand("border-block-start-color", "red")).toEqual([["border-color", "red"]]);
    expect(expand("border-block-end-color", "red")).toEqual([]);
    expect(expand("border-inline-start-color", "red", vlr)).toEqual([["border-color", "red"]]);
    expect(expand("border-inline-end-color", "red", vlr)).toEqual([]);
    expect(expand("border-start-end-radius", "1px", rtl)).toEqual([["border-radius", "1px"]]);
    expect(expand("border-start-start-radius", "1px", rtl)).toEqual([]);
    expect(expand("border-end-start-radius", "1px", vrl)).toEqual([["border-radius", "1px"]]);
  });
});

test("axisOf folds sides and leaves the rest", () => {
  expect(axisOf("padding-left")).toBe("padding-inline");
  expect(axisOf("padding-right")).toBe("padding-inline");
  expect(axisOf("margin-top")).toBe("margin-block");
  expect(axisOf("margin-bottom")).toBe("margin-block");
  expect(axisOf("row-gap")).toBe("gap");
  expect(axisOf("column-gap")).toBe("gap");
  expect(axisOf("height")).toBe("height");
  expect(axisOf("scroll-padding-left")).toBe("scroll-padding-left");
  expect(axisOf("padding-left-x")).toBe("padding-left-x");
  expect(axisOf("grid-row-gap")).toBe("grid-row-gap");
  expect(axisOf("row-gap-x")).toBe("row-gap-x");
  expect(axisOf("padding-top-x")).toBe("padding-top-x");
  expect(axisOf("scroll-margin-top")).toBe("scroll-margin-top");
});
