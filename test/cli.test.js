/**
 * End-to-end: the real `jarek` binary, run the way a shell runs it. Each run
 * gets its own empty configuration directory and never touches the network.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";

const root = fileURLToPath(new URL("..", import.meta.url));
const bin = join(root, "bin", "jarek.js");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const homes = [];

after(() => {
  for (const home of homes) rmSync(home, { recursive: true, force: true });
});

function jarek(args, { config } = {}) {
  const home = mkdtempSync(join(tmpdir(), "jarek-cli-"));
  homes.push(home);
  const file = join(home, "jarek", "config.json");
  if (config) {
    mkdirSync(join(home, "jarek"), { recursive: true });
    writeFileSync(file, JSON.stringify(config));
  }
  const result = spawnSync(process.execPath, [bin, ...args], {
    cwd: root,
    encoding: "utf8",
    timeout: 60_000,
    env: { ...process.env, XDG_CONFIG_HOME: home, APPDATA: home, NO_COLOR: "1" },
  });
  return { ...result, file, config: () => JSON.parse(readFileSync(file, "utf8")) };
}

test("--version prints the package version", () => {
  const run = jarek(["--version"]);
  assert.equal(run.status, 0);
  assert.equal(run.stdout.trim(), `jarek v${pkg.version}`);
});

test("--help lists every command", () => {
  const run = jarek(["--lang", "en", "--help"]);
  assert.equal(run.status, 0);
  for (const word of ["focus", "scan", "break", "weather", "news", "protocol", "personalize", "theme", "bye"]) {
    assert.match(run.stdout, new RegExp(`^  ${word}\\b`, "m"), word);
  }
});

test("an unknown command fails politely", () => {
  const run = jarek(["--lang", "en", "fly"]);
  assert.equal(run.status, 1);
  assert.match(run.stdout, /I don't know "fly", Sir/);
});

test("theme saves a built-in theme", () => {
  const run = jarek(["--lang", "en", "theme", "arc"]);
  assert.equal(run.status, 0);
  assert.equal(run.config().theme, "arc");
});

test("theme saves custom colours, normalised", () => {
  const run = jarek(["--lang", "en", "theme", "#FF0080", "7928ca"]);
  assert.equal(run.status, 0);
  assert.deepEqual(run.config().theme, ["#ff0080", "#7928ca"]);
});

test("theme refuses nonsense and writes nothing", () => {
  const run = jarek(["--lang", "en", "theme", "rainbow"]);
  assert.match(run.stdout, /neither a theme nor a list of colours/);
  assert.equal(existsSync(run.file), false);
});

test("a protocol runs its steps in order and reports each outcome", () => {
  const run = jarek(["--lang", "en", "protocol", "demo"], {
    config: {
      protocols: {
        demo: [{ label: "first", run: "exit 0" }, { label: "second", run: "exit 3" }, { label: "third" }],
      },
    },
  });
  assert.equal(run.status, 0);
  const statuses = run.stdout
    .split("\n")
    .filter((text) => /\[.{4}\]/.test(text))
    .map((text) => text.trim());
  assert.deepEqual(statuses, ["[ OK ] first", "[WARN] second", "[WARN] third"]);
  assert.match(run.stdout, /Protocol complete with 2 warnings, Sir\./);
});

test("offline, the briefing uses the configured name and stays local", () => {
  const run = jarek(["--lang", "en", "--no-net", "--fast", "--no-repl"], {
    config: { title: { kind: "name", value: "Ada" } },
  });
  assert.equal(run.status, 0);
  assert.match(run.stdout, /(Good (morning|afternoon|evening), Ada\.|Still up at this hour, Ada\?)/);
  assert.match(run.stdout, /We are offline, Ada\. Local systems only\./);
});

test("without a terminal, the first run skips the questions and saves nothing", () => {
  const run = jarek(["--lang", "en", "--no-net", "--fast", "--no-repl"]);
  assert.equal(run.status, 0);
  assert.doesNotMatch(run.stdout, /FIRST CONFIGURATION/);
  assert.equal(existsSync(run.file), false);
});
