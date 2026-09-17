import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";

import { configPath, defaultConfig, loadConfig, saveConfig, startupSound } from "../src/config.js";
import { createContext } from "../src/context.js";
import { THEMES } from "../src/themes.js";
import { getPalette } from "../src/ui.js";

let dir;
let saved;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "jarek-config-"));
  saved = { XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME, APPDATA: process.env.APPDATA };
  process.env.XDG_CONFIG_HOME = dir;
  process.env.APPDATA = dir;
});

afterEach(() => {
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  rmSync(dir, { recursive: true, force: true });
});

test("the configuration lives under the platform config directory", () => {
  assert.equal(configPath(), join(dir, "jarek", "config.json"));
});

test("no file means no configuration yet", () => {
  assert.equal(loadConfig(), null);
});

test("saving and loading round-trips, with defaults filled in", () => {
  saveConfig({ ...defaultConfig(), city: "Roma" });
  const loaded = loadConfig();
  assert.equal(loaded.city, "Roma");
  assert.equal(loaded.version, 1);
  assert.equal(loaded.theme, "instagram");
});

test("incomplete or odd files are completed with defaults", () => {
  mkdirSync(join(dir, "jarek"), { recursive: true });
  writeFileSync(configPath(), JSON.stringify({ title: { value: "x" }, protocols: "nope" }));
  const loaded = loadConfig();
  assert.equal(loaded.title.kind, "sir");
  assert.equal(loaded.sound, true);
  assert.deepEqual(loaded.protocols, {});
});

test("a broken file is treated as no configuration", () => {
  mkdirSync(join(dir, "jarek"), { recursive: true });
  writeFileSync(configPath(), "{ not json");
  assert.equal(loadConfig(), null);
});

test("saving leaves no temporary file behind", () => {
  saveConfig(defaultConfig());
  assert.deepEqual(readdirSync(join(dir, "jarek")), ["config.json"]);
});

test("a context change is saved and applied at once: title and colours", () => {
  const ctx = createContext({ config: null, lang: "it", locale: "it-IT", country: "IT", options: {} });
  assert.equal(ctx.firstRun, true);

  ctx.save({ title: { kind: "name", value: "Ada" }, theme: "arc" });

  assert.equal(ctx.firstRun, false);
  assert.equal(ctx.strings.greeting.morning, "Buongiorno, Ada.");
  assert.deepEqual(getPalette(), THEMES.arc);
  assert.equal(loadConfig().title.value, "Ada");
});

test("a personal startup sound is used only when the file exists", () => {
  const shipped = "/package/assets/jarek-startup.wav";
  const mine = join(dir, "my-intro.wav");
  writeFileSync(mine, "");
  assert.equal(startupSound({ startupSound: mine }, shipped), mine);
  assert.equal(startupSound({ startupSound: join(dir, "missing.wav") }, shipped), shipped);
  assert.equal(startupSound({ startupSound: "  " }, shipped), shipped);
  assert.equal(startupSound({}, shipped), shipped);
});
