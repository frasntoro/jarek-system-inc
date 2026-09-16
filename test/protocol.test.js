import assert from "node:assert/strict";
import { test } from "node:test";

import { describeStep, matchApps, normalizeSite } from "../src/commands/protocol.js";
import { getStrings } from "../src/i18n.js";

test("websites are completed the way people type them", () => {
  assert.equal(normalizeSite("github.com"), "https://github.com/");
  assert.equal(normalizeSite("https://example.org/docs"), "https://example.org/docs");
  assert.equal(normalizeSite("localhost:3000"), "http://localhost:3000/");
  for (const invalid of ["", "hello", "two words.com", "ftp://example.com"]) {
    assert.equal(normalizeSite(invalid), null, invalid);
  }
});

test("apps are matched by exact name first, then by partial name", () => {
  const apps = ["Chrome Remote Desktop", "Google Chrome", "Notes", "Safari"];
  assert.deepEqual(matchApps("safari", apps), ["Safari"]);
  assert.deepEqual(matchApps("google chrome", apps), ["Google Chrome"]);
  assert.deepEqual(matchApps("chrome", apps), ["Chrome Remote Desktop", "Google Chrome"]);
  assert.deepEqual(matchApps("photoshop", apps), []);
  assert.deepEqual(matchApps("  ", apps), []);
});

test("every kind of action is described in words", () => {
  const strings = getStrings("it");
  assert.equal(describeStep({ label: "Il mio passo", app: "Safari" }, strings), "Il mio passo");
  assert.equal(describeStep({ app: "Google Chrome" }, strings), "Apro Google Chrome");
  assert.equal(describeStep({ open: "https://github.com/" }, strings), "Apro github.com");
  assert.equal(describeStep({ open: "~/Documents" }, strings), "Apro ~/Documents");
  assert.equal(describeStep({ run: "npm run dev" }, strings), "Eseguo: npm run dev");
  assert.equal(describeStep({}, strings), "azione senza nulla da fare");
});
