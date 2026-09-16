import assert from "node:assert/strict";
import { test } from "node:test";

import { getStrings } from "../src/i18n.js";
import { DEFAULT_THEME, THEMES, parseHex, parseThemeInput, themeLabel, themePalette } from "../src/themes.js";

test("parseHex reads six- and three-digit colours, with or without #", () => {
  assert.deepEqual(parseHex("#ff0080"), [255, 0, 128]);
  assert.deepEqual(parseHex("7928CA"), [121, 40, 202]);
  assert.deepEqual(parseHex("#f08"), [255, 0, 136]);
  assert.equal(parseHex("#ff00"), null);
  assert.equal(parseHex("red"), null);
});

test("parseThemeInput accepts built-in names in any case", () => {
  assert.equal(parseThemeInput("ARC"), "arc");
  assert.equal(parseThemeInput("  iron "), "iron");
});

test("parseThemeInput tolerates the command word typed again", () => {
  assert.equal(parseThemeInput("tema instagram"), "instagram");
  assert.equal(parseThemeInput("theme ARC"), "arc");
  assert.deepEqual(parseThemeInput("colori #ff0080 #7928ca"), ["#ff0080", "#7928ca"]);
  assert.equal(parseThemeInput("tema"), null);
});

test("parseThemeInput normalises custom colours, separated by spaces or commas", () => {
  assert.deepEqual(parseThemeInput("#FF0080, 7928ca"), ["#ff0080", "#7928ca"]);
  assert.deepEqual(parseThemeInput("#f08 #000"), ["#ff0088", "#000000"]);
});

test("parseThemeInput rejects nonsense and single colours", () => {
  for (const input of ["", "rainbow", "#ff0080", "#ff0080 blue"]) {
    assert.equal(parseThemeInput(input), null, input);
  }
});

test("themePalette falls back to the default theme when it cannot read one", () => {
  assert.equal(themePalette(undefined), THEMES[DEFAULT_THEME]);
  assert.equal(themePalette("nope"), THEMES[DEFAULT_THEME]);
  assert.equal(themePalette(["#ff0080"]), THEMES[DEFAULT_THEME]);
  assert.equal(themePalette("Iron"), THEMES.iron);
  assert.deepEqual(themePalette(["#ff0080", "#7928ca"]), [
    [255, 0, 128],
    [121, 40, 202],
  ]);
});

test("every built-in theme has at least two valid RGB stops", () => {
  for (const [name, stops] of Object.entries(THEMES)) {
    assert.ok(stops.length >= 2, name);
    for (const stop of stops) {
      assert.equal(stop.length, 3, name);
      for (const channel of stop) assert.ok(Number.isInteger(channel) && channel >= 0 && channel <= 255, name);
    }
  }
});

test("themeLabel names built-in and custom themes", () => {
  const strings = getStrings("en");
  assert.equal(themeLabel(undefined, strings), "instagram");
  assert.equal(themeLabel("arc", strings), "arc");
  assert.equal(themeLabel(["#ff0080", "#7928ca"], strings), "custom #ff0080 #7928ca");
});
