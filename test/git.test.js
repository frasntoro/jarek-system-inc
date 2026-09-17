import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { commitsToday } from "../src/sources/git.js";

const hasGit = (() => {
  try {
    execFileSync("git", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

test("counts today's commits across the repositories under a folder", { skip: !hasGit && "git is not installed" }, async () => {
  const root = mkdtempSync(join(tmpdir(), "jarek-git-"));
  // An empty global config: no author filter, and nothing from the machine leaks in.
  const globalConfig = join(root, "gitconfig");
  writeFileSync(globalConfig, "");
  const previous = process.env.GIT_CONFIG_GLOBAL;
  process.env.GIT_CONFIG_GLOBAL = globalConfig;

  const makeRepository = (name, commits, { localEmail, authorEmail = "test@example.com" } = {}) => {
    const repository = join(root, "work", name);
    mkdirSync(repository, { recursive: true });
    const git = (...args) =>
      execFileSync(
        "git",
        ["-C", repository, "-c", "user.name=Test", "-c", `user.email=${authorEmail}`, "-c", "commit.gpgsign=false", ...args],
        { stdio: "ignore" },
      );
    git("init", "-q");
    if (localEmail) execFileSync("git", ["-C", repository, "config", "user.email", localEmail], { stdio: "ignore" });
    for (let index = 0; index < commits; index += 1) git("commit", "-q", "--allow-empty", "-m", `commit ${index}`);
  };

  try {
    makeRepository("alpha", 3);
    makeRepository("beta", 1);
    makeRepository("empty", 0);
    // Dependencies are never scanned.
    mkdirSync(join(root, "work", "node_modules", "hidden", ".git"), { recursive: true });

    const result = await commitsToday({ roots: [join(root, "work")], includeCurrent: false });

    assert.equal(result.total, 4);
    assert.deepEqual(result.repos, [
      { name: "alpha", count: 3 },
      { name: "beta", count: 1 },
    ]);
  } finally {
    if (previous === undefined) delete process.env.GIT_CONFIG_GLOBAL;
    else process.env.GIT_CONFIG_GLOBAL = previous;
    rmSync(root, { recursive: true, force: true });
  }
});

test("each repository counts only its own user's commits", { skip: !hasGit && "git is not installed" }, async () => {
  const root = mkdtempSync(join(tmpdir(), "jarek-git-author-"));
  const globalConfig = join(root, "gitconfig");
  writeFileSync(globalConfig, "[user]\n\temail = old-name@example.com\n");
  const previous = process.env.GIT_CONFIG_GLOBAL;
  process.env.GIT_CONFIG_GLOBAL = globalConfig;

  const repository = join(root, "work", "mine");
  const git = (email, ...args) =>
    execFileSync("git", ["-C", repository, "-c", "user.name=Test", "-c", `user.email=${email}`, "-c", "commit.gpgsign=false", ...args], {
      stdio: "ignore",
    });
  try {
    mkdirSync(repository, { recursive: true });
    execFileSync("git", ["-C", repository, "init", "-q"], { stdio: "ignore" });
    // This repository commits with its own local email, not the global one.
    execFileSync("git", ["-C", repository, "config", "user.email", "me@example.com"], { stdio: "ignore" });
    git("me@example.com", "commit", "-q", "--allow-empty", "-m", "mine 1");
    git("me@example.com", "commit", "-q", "--allow-empty", "-m", "mine 2");
    git("someone-else@example.com", "commit", "-q", "--allow-empty", "-m", "theirs");

    const result = await commitsToday({ roots: [join(root, "work")], includeCurrent: false });
    assert.deepEqual(result.repos, [{ name: "mine", count: 2 }]);
  } finally {
    if (previous === undefined) delete process.env.GIT_CONFIG_GLOBAL;
    else process.env.GIT_CONFIG_GLOBAL = previous;
    rmSync(root, { recursive: true, force: true });
  }
});
