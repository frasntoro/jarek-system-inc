import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import {
  closingFor,
  describeWeather,
  detectLocale,
  getStrings,
  greetingFor,
  personalize,
  titleFor,
  unitsFor,
} from "../src/i18n.js";

const LOCALE_VARIABLES = ["LC_ALL", "LC_MESSAGES", "LANG", "LANGUAGE"];
let saved;

beforeEach(() => {
  saved = Object.fromEntries(LOCALE_VARIABLES.map((name) => [name, process.env[name]]));
  for (const name of LOCALE_VARIABLES) delete process.env[name];
});

afterEach(() => {
  for (const name of LOCALE_VARIABLES) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
});

/* ---------------------------------------------------------------- locale */

test("an explicit --lang wins over the environment", () => {
  process.env.LC_ALL = "en_US.UTF-8";
  assert.deepEqual(detectLocale("it"), { locale: "it", lang: "it", country: "" });
});

test("LC_ALL is honoured and normalised", () => {
  process.env.LC_ALL = "it_IT.UTF-8";
  assert.deepEqual(detectLocale(), { locale: "it-IT", lang: "it", country: "IT" });
});

test("locale modifiers are ignored", () => {
  process.env.LC_MESSAGES = "it_IT@euro";
  assert.equal(detectLocale().lang, "it");
});

test("untranslated languages fall back to English but keep the region", () => {
  process.env.LC_ALL = "fr_FR.UTF-8";
  assert.deepEqual(detectLocale(), { locale: "en-FR", lang: "en", country: "FR" });
});

test(
  "the neutral C locale says nothing, so LANG decides",
  { skip: process.platform === "darwin" && "on macOS the system language is read before LANG" },
  () => {
    process.env.LC_ALL = "C.UTF-8";
    process.env.LANG = "it_IT.UTF-8";
    assert.equal(detectLocale().lang, "it");
  },
);

/* --------------------------------------------------------------- strings */

test("English and Italian define exactly the same keys", () => {
  const keys = (object, prefix = "") =>
    Object.entries(object).flatMap(([key, value]) =>
      value && typeof value === "object" && !Array.isArray(value) ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`],
    );
  assert.deepEqual(keys(getStrings("it")).sort(), keys(getStrings("en")).sort());
});

test("personalize fills {title} in plain strings and in generated ones", () => {
  const strings = personalize(getStrings("it"), "Francesco");
  assert.equal(strings.greeting.morning, "Buongiorno, Francesco.");
  assert.equal(strings.protocol.notFound("demo"), 'Non esiste un protocollo "demo", Francesco.');
});

test("no {title} placeholder survives personalisation", () => {
  for (const lang of ["en", "it"]) {
    const visit = (value) => {
      if (typeof value === "string") assert.ok(!value.includes("{title}"), `${lang}: ${value}`);
      else if (typeof value === "function") visit(value(1, 2, 3));
      else if (value && typeof value === "object") Object.values(value).forEach(visit);
    };
    visit(personalize(getStrings(lang), "Ada"));
  }
});

test("titleFor uses the configured title, in the right language", () => {
  assert.equal(titleFor(null, "it"), "signore");
  assert.equal(titleFor({ title: { kind: "madam" } }, "en"), "Ma'am");
  assert.equal(titleFor({ title: { kind: "name", value: "  Ada " } }, "it"), "Ada");
  assert.equal(titleFor({ title: { kind: "name", value: "" } }, "it"), "signore");
  assert.equal(titleFor({ title: { kind: "unknown" } }, "en"), "Sir");
});

test("units follow the country", () => {
  assert.equal(unitsFor("US"), "imperial");
  assert.equal(unitsFor("IT"), "metric");
  assert.equal(unitsFor(""), "metric");
});

test("greeting and farewell follow the clock", () => {
  const strings = getStrings("en");
  const expected = [
    [3, "night"],
    [4, "night"],
    [5, "morning"],
    [11, "morning"],
    [12, "afternoon"],
    [17, "afternoon"],
    [18, "evening"],
    [23, "evening"],
  ];
  for (const [hour, part] of expected) {
    assert.equal(greetingFor(hour, strings), strings.greeting[part], `greeting at ${hour}`);
    assert.equal(closingFor(hour, strings), strings.briefing.closing[part], `closing at ${hour}`);
  }
});

test("weather codes are described, unknown ones stay empty", () => {
  assert.equal(describeWeather(0, "it"), "cielo sereno");
  assert.equal(describeWeather(61, "xx"), "light rain");
  assert.equal(describeWeather(999, "it"), "");
});
