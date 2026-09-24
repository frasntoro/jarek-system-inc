import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { animationNames, findAnimation, registerAnimation, resetAnimations } from "../src/animations.js";
import { COMMANDS, findCommand, registerCommand } from "../src/commands/index.js";
import { breakCommand } from "../src/commands/matrix.js";
import { asCommand, loadPlugins, pluginFiles } from "../src/plugins.js";

function folderWith(files) {
  const folder = mkdtempSync(join(tmpdir(), "jarek-plugins-"));
  for (const [name, source] of Object.entries(files)) writeFileSync(join(folder, name), source, "utf8");
  return folder;
}

test("only real .js files are considered, in a stable order", () => {
  const folder = folderWith({
    "b.js": "export default {}",
    "a.js": "export default {}",
    "notes.md": "# not a plugin",
    ".hidden.js": "export default {}",
  });
  try {
    mkdirSync(join(folder, "nested.js"));
    assert.deepEqual(
      pluginFiles(folder).map((file) => file.split("/").pop()),
      ["a.js", "b.js"],
    );
    assert.deepEqual(pluginFiles(join(folder, "missing")), [], "no folder is not an error");
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("a command is kept to its shape, and cannot take a name already in use", () => {
  const good = asCommand({ name: "Home", aliases: ["CASA", "home"], run: () => {}, about: "x", fullscreen: true });
  assert.deepEqual(good, {
    name: "home",
    aliases: ["casa"],
    run: good.run,
    fullscreen: true,
    exits: false,
    mine: true,
    usage: "home",
    about: "x",
  });

  assert.equal(asCommand({ name: "home" }), null, "a command with nothing to run");
  assert.equal(asCommand({ run: () => {} }), null, "a command with no name");
  assert.equal(asCommand({ name: "rm -rf", run: () => {} }), null, "a name that is not a word");
  assert.equal(asCommand({ name: "scan", run: () => {} }, { taken: new Set(["scan"]) }), null, "a name in use");
  // An alias already spoken for is dropped; the command itself still stands.
  const partly = asCommand({ name: "home", aliases: ["casa", "scan"], run: () => {} }, { taken: new Set(["scan"]) });
  assert.deepEqual(partly.aliases, ["casa"]);
  assert.equal(asCommand("not an object"), null);
});

test("plugins load, and a broken one is reported without stopping the rest", async () => {
  const folder = folderWith({
    "01-good.js": 'export default { name: "alpha", about: "first", run: () => "a" };',
    "02-broken.js": "this is not javascript {{{",
    "03-throws.js": 'throw new Error("boom");',
    "04-empty.js": "export const nothing = true;",
    "05-many.js": 'export const commands = [{ name: "beta", run: () => "b" }, { name: "gamma", run: () => "c" }];',
  });
  try {
    const { commands, problems } = await loadPlugins({ folder });
    assert.deepEqual(commands.map((command) => command.name), ["alpha", "beta", "gamma"]);
    assert.equal(await commands[0].run(), "a");

    const reported = problems.map((problem) => problem.file.split("/").pop()).sort();
    assert.deepEqual(reported, ["02-broken.js", "03-throws.js", "04-empty.js"]);
    assert.ok(problems.every((problem) => typeof problem.reason === "string" && problem.reason.length > 0));
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("a plugin cannot take over a built-in name, whichever way it tries", async () => {
  const folder = folderWith({
    "takeover.js": 'export const commands = [{ name: "scan", run: () => "mine" }, { name: "ok", aliases: ["bye"], run: () => "fine" }];',
  });
  try {
    const { commands } = await loadPlugins({ folder, taken: new Set(["scan", "bye"]) });
    assert.deepEqual(commands.map((command) => command.name), ["ok"]);
    assert.deepEqual(commands[0].aliases, [], "the alias that was taken is dropped, the command survives");
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("registering leaves the built-ins alone", () => {
  const before = COMMANDS.length;
  try {
    assert.equal(registerCommand({ name: "scan", run: () => {} }), false, "a built-in name is refused");
    assert.equal(registerCommand({ name: "diagnostica", run: () => {} }), false, "so is one of its aliases");
    assert.equal(registerCommand({ name: "mine-only", run: () => "yes" }), true);
    assert.equal(findCommand("mine-only")?.run(), "yes");
    assert.equal(findCommand("scan").name, "scan", "the built-in still answers");
  } finally {
    COMMANDS.length = before;
  }
});

test("animations are registered too, and break falls back to the rain", async () => {
  const folder = folderWith({
    "shows.js": `
      export const animations = [
        { name: "aurora", about: "lights", run: () => "aurora ran" },
        { name: "Bad Name!", run: () => {} },
        { name: "nothing" },
      ];
    `,
  });
  try {
    const { animations, commands, problems } = await loadPlugins({ folder });
    assert.deepEqual(animations.map((animation) => animation.name), ["aurora"]);
    assert.deepEqual(commands, []);
    assert.deepEqual(problems, [], "a file with only animations is not a problem");

    for (const animation of animations) registerAnimation(animation);
    assert.equal(findAnimation("Aurora").run(), "aurora ran", "the name is not case sensitive");
    assert.equal(findAnimation("missing"), null);
    assert.ok(animationNames().includes("matrix"), "the rain is always there");

    // The rain cannot be replaced by a plugin claiming its name.
    assert.equal(registerAnimation({ name: "matrix", run: () => "hijacked" }), false);
  } finally {
    resetAnimations(["matrix"]);
    rmSync(folder, { recursive: true, force: true });
  }
});

test("break plays what it is asked for, and says so when it cannot", async () => {
  const ctx = { strings: { repl: { noAnimation: (name, names) => `no ${name} · ${names}` } } };
  let played = null;
  registerAnimation({ name: "aurora", run: (args) => { played = args; } });
  try {
    await breakCommand(["aurora", "verde"], ctx);
    assert.deepEqual(played, ["verde"], "the rest of the line reaches the animation");

    const said = [];
    const original = process.stdout.write.bind(process.stdout);
    process.stdout.write = (text) => { said.push(String(text)); return true; };
    try {
      await breakCommand(["nowhere"], ctx);
    } finally {
      process.stdout.write = original;
    }
    assert.match(said.join(""), /no nowhere · .*aurora/);
  } finally {
    resetAnimations(["matrix"]);
  }
});
