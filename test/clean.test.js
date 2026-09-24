import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  CATALOG,
  activeRules,
  catalogFor,
  cleanConfig,
  destinationFor,
  expandHome,
  formatSize,
  moveToTrash,
  normalizeRule,
  removeTarget,
  ruleId,
  rulePath,
  shortenHome,
  validateTarget,
} from "../src/cleanup.js";
import { getStrings } from "../src/i18n.js";

/** A throwaway home directory, so the safety rules are tested for real. */
function fakeHome() {
  const home = mkdtempSync(join(tmpdir(), "jarek-clean-"));
  mkdirSync(join(home, "Library", "Caches", "pip"), { recursive: true });
  mkdirSync(join(home, "Documents"), { recursive: true });
  return home;
}

test("nothing outside the home directory can ever be cleaned", () => {
  const home = fakeHome();
  try {
    for (const target of ["/", "/System", "/usr/local", "/etc/hosts", "/Volumes/Backup", "/tmp"]) {
      const result = validateTarget(target, { home });
      assert.equal(result.ok, false, target);
      assert.equal(result.reason, "outside", target);
    }
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("the folders people keep their own things in are refused, their contents are not", () => {
  const home = fakeHome();
  try {
    for (const name of ["", "Documents", "Library", "Library/Caches", "Library/Application Support", ".config"]) {
      const target = name ? join(home, name) : home;
      mkdirSync(target, { recursive: true });
      const result = validateTarget(target, { home });
      assert.equal(result.ok, false, target);
      assert.equal(result.reason, "protected", target);
    }
    // One level deeper is exactly what clean is for.
    assert.equal(validateTarget(join(home, "Library", "Caches", "pip"), { home }).ok, true);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("a path that climbs out, or is a link, is refused before anything is touched", () => {
  const home = fakeHome();
  const outside = mkdtempSync(join(tmpdir(), "jarek-outside-"));
  try {
    writeFileSync(join(outside, "keep.txt"), "important");

    assert.equal(validateTarget(`${home}/Library/../../etc`, { home }).reason, "traversal");
    assert.equal(validateTarget("Library/Caches/pip", { home }).reason, "relative");
    assert.equal(validateTarget("", { home }).reason, "empty");
    assert.equal(validateTarget(join(home, "Library", "Caches", "gone"), { home }).reason, "missing");

    // A link inside the home directory pointing anywhere is still a link.
    const link = join(home, "Library", "Caches", "escape");
    symlinkSync(outside, link);
    assert.equal(validateTarget(link, { home }).reason, "symlink");

    // And a link in the middle of the path is followed before judging.
    const through = join(link, "deep");
    mkdirSync(join(outside, "deep"));
    assert.equal(validateTarget(through, { home }).reason, "outside");

    assert.ok(existsSync(join(outside, "keep.txt")), "nothing outside was touched");
  } finally {
    rmSync(home, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test("removeTarget refuses what validateTarget refuses, and never leaves it half done", () => {
  const home = fakeHome();
  try {
    const protectedRoot = join(home, "Documents");
    writeFileSync(join(protectedRoot, "thesis.txt"), "years of work");
    const refused = removeTarget(protectedRoot, { home, mode: "delete" });
    assert.deepEqual(refused, { ok: false, reason: "protected" });
    assert.ok(existsSync(join(protectedRoot, "thesis.txt")));

    const cache = join(home, "Library", "Caches", "pip");
    assert.deepEqual(removeTarget(cache, { home, mode: "delete" }), { ok: true, action: "deleted" });
    assert.equal(existsSync(cache), false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("what goes to the Trash comes back, and a second one does not overwrite the first", () => {
  const home = fakeHome();
  try {
    const trash = process.platform === "darwin" ? join(home, ".Trash") : join(home, ".local", "share", "Trash", "files");
    for (const round of [1, 2]) {
      const folder = join(home, "Library", "Caches", "review");
      mkdirSync(folder, { recursive: true });
      writeFileSync(join(folder, "data.txt"), `round ${round}`);
      assert.deepEqual(removeTarget(folder, { home, mode: "trash" }), { ok: true, action: "trashed" });
      assert.equal(existsSync(folder), false);
    }
    assert.ok(existsSync(join(trash, "review")), "the first one is in the Trash");
    assert.ok(existsSync(join(trash, "review 2")), "the second one did not replace it");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("a Trash that cannot be reached is reported, never turned into a delete", () => {
  const home = fakeHome();
  try {
    // A file where the Trash folder should be: creating it can only fail.
    const trashRoot = process.platform === "darwin" ? join(home, ".Trash") : join(home, ".local");
    mkdirSync(join(home, ".local"), { recursive: true });
    rmSync(trashRoot, { recursive: true, force: true });
    writeFileSync(trashRoot, "not a folder");

    const folder = join(home, "Library", "Caches", "pip");
    assert.deepEqual(removeTarget(folder, { home, mode: "trash" }), { ok: false, reason: "trash" });
    assert.ok(existsSync(folder), "the folder is still there");
    assert.equal(moveToTrash(folder, home), false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("caches are deleted and everything else is recoverable", () => {
  assert.equal(destinationFor("safe"), "delete");
  assert.equal(destinationFor("leftover"), "delete");
  assert.equal(destinationFor("review"), "trash");
  assert.equal(destinationFor("projects"), "trash");
});

test("the shipped catalogue is consistent, and every note is written in both languages", () => {
  const ids = new Set();
  const en = getStrings("en").clean;
  const it = getStrings("it").clean;

  for (const rule of CATALOG) {
    assert.ok(!ids.has(rule.id), `duplicate id: ${rule.id}`);
    ids.add(rule.id);
    assert.ok(rule.label, `${rule.id} has no label`);
    assert.ok(["safe", "review", "leftover"].includes(rule.group), `${rule.id} has group ${rule.group}`);

    const path = rulePath(rule, "darwin");
    assert.ok(path.startsWith("~/"), `${rule.id} points at ${path}`);
    assert.equal(validateTarget(path, { home: "/home/tester", mustExist: false }).ok, true, `${rule.id} is not cleanable`);

    if (rule.note) {
      assert.ok(en.notes[rule.note], `${rule.id}: note missing in English`);
      assert.ok(it.notes[rule.note], `${rule.id}: note missing in Italian`);
    }
  }
});

test("off a Mac, only the entries that are not about macOS are offered", () => {
  const mac = catalogFor("darwin");
  const linux = catalogFor("linux");
  assert.ok(linux.length > 0 && linux.length < mac.length);
  assert.ok(linux.every((rule) => !rulePath(rule, "linux").startsWith("~/Library")));
  assert.ok(linux.some((rule) => rule.id === "npm"), "the npm cache exists everywhere");
  assert.ok(!linux.some((rule) => rule.id === "xcode-derived"), "Xcode does not");
});

test("an entry of the user's is kept to what an entry may hold", () => {
  const rule = normalizeRule({
    label: "  Figma  ",
    path: "~/Library/Caches/Figma",
    group: "review",
    process: "Figma",
    text: "Design files stay in the cloud",
    run: "rm -rf /",
  });
  assert.deepEqual(rule, {
    id: "my-figma",
    group: "review",
    label: "Figma",
    path: "~/Library/Caches/Figma",
    process: "Figma",
    text: "Design files stay in the cloud",
  });

  assert.equal(normalizeRule({ label: "No target" }), null);
  assert.equal(normalizeRule({ path: "~/x" }), null);
  // "projects" is Jarek's own group, not something a user can claim.
  assert.equal(normalizeRule({ label: "x", path: "~/x", group: "projects" }).group, "safe");
  assert.equal(ruleId("Figma", ["my-figma"]), "my-figma-2");
});

test("the muted list hides an entry without removing it from the catalogue", () => {
  const config = { clean: { rules: [{ label: "Figma", path: "~/Library/Caches/Figma" }], skip: ["chrome"] } };
  const rules = activeRules(config, "darwin");
  assert.ok(rules.some((rule) => rule.id === "my-figma"), "the user's entry is there");
  assert.ok(!rules.some((rule) => rule.id === "chrome"), "the muted one is not");
  assert.ok(CATALOG.some((rule) => rule.id === "chrome"), "but the catalogue still has it");
});

test("a configuration with nothing in it still answers every question", () => {
  const empty = cleanConfig(undefined);
  assert.deepEqual(empty.rules, []);
  assert.deepEqual(empty.skip, []);
  assert.deepEqual(empty.projectPaths, ["~/Developer", "~/Documents", "~/Desktop"]);
  assert.deepEqual(cleanConfig({ clean: { rules: "nonsense", skip: [1, "ok"] } }).skip, ["ok"]);
});

test("sizes read the way people say them, and paths shorten to ~", () => {
  assert.equal(formatSize(0), "0K");
  assert.equal(formatSize(512), "512K");
  assert.equal(formatSize(1024), "1M");
  assert.equal(formatSize(102_400), "100M");
  assert.equal(formatSize(1_048_576), "1.0G");
  assert.equal(formatSize(12_582_912), "12.0G");
  assert.equal(shortenHome("/Users/tester/Library/Caches", "/Users/tester"), "~/Library/Caches");
  assert.equal(shortenHome("/opt/homebrew", "/Users/tester"), "/opt/homebrew");
  assert.equal(expandHome("~/x", "/Users/tester"), "/Users/tester/x");
  assert.equal(expandHome("~", "/Users/tester"), "/Users/tester");
  assert.equal(expandHome("/tmp/x", "/Users/tester"), "/tmp/x");
});
