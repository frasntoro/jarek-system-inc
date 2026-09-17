/**
 * Today's commits, for the summary at `bye`. Repositories are found by walking
 * the usual project folders a few levels deep; the walk is bounded so a huge
 * home directory can never make the goodbye slow.
 */

import { execFile } from "node:child_process";
import { existsSync, readdirSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

const SKIP = new Set([
  "node_modules",
  "Library",
  "Applications",
  "Pictures",
  "Music",
  "Movies",
  "venv",
  "dist",
  "build",
  "target",
  "vendor",
]);

function git(args, timeout = 2500) {
  return new Promise((resolve) => {
    execFile("git", args, { timeout, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) =>
      resolve(error ? null : String(stdout)),
    );
  });
}

export function defaultWorkspaces() {
  const home = homedir();
  return ["Developer", "Projects", "projects", "Code", "code", "src", "dev", "workspace", join("Documents", "GitHub")]
    .map((folder) => join(home, folder))
    .filter((folder) => existsSync(folder));
}

function findRepositories(roots, { maxDepth = 3, maxVisited = 4000, maxRepos = 80 } = {}) {
  const repositories = new Map();
  const queue = roots.map((dir) => ({ dir, depth: 0 }));
  let visited = 0;

  while (queue.length && visited < maxVisited && repositories.size < maxRepos) {
    const { dir, depth } = queue.shift();
    visited += 1;

    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    if (entries.some((entry) => entry.name === ".git")) {
      // Case-insensitive file systems can reach one folder by two spellings.
      let key = dir;
      try {
        key = realpathSync.native(dir);
      } catch {
        // Keep the path as found.
      }
      repositories.set(key, dir);
      continue;
    }

    if (depth >= maxDepth) continue;
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".") && !SKIP.has(entry.name)) {
        queue.push({ dir: join(dir, entry.name), depth: depth + 1 });
      }
    }
  }
  return [...repositories.values()];
}

/**
 * Resolves with `{ total, repos: [{ name, count }] }`, or null when git is not
 * installed. Commits are counted per author, using the email each repository
 * itself commits with — a local user.email overrides the global one, and
 * people do set different ones per project. The repository Jarek was started
 * in is included unless `includeCurrent` is false.
 */
export async function commitsToday({ roots = defaultWorkspaces(), includeCurrent = true } = {}) {
  if ((await git(["--version"])) === null) return null;

  const current = includeCurrent ? (await git(["rev-parse", "--show-toplevel"]))?.trim() : null;
  const repositories = findRepositories(current ? [...roots, current] : roots);

  const results = [];
  let next = 0;
  const worker = async () => {
    while (next < repositories.length) {
      const repository = repositories[next];
      next += 1;
      const email = (await git(["-C", repository, "config", "user.email"]))?.trim();
      const output = await git([
        "-C",
        repository,
        "log",
        "--branches",
        "--remotes",
        "--no-merges",
        "--since=midnight",
        "--format=%H",
        ...(email ? [`--author=${email}`] : []),
      ]);
      const count = output ? output.split("\n").filter(Boolean).length : 0;
      if (count) results.push({ name: basename(repository), count });
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, repositories.length) }, worker));

  results.sort((a, b) => b.count - a.count);
  return { total: results.reduce((sum, repo) => sum + repo.count, 0), repos: results };
}
