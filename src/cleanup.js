/**
 * What `clean` knows and what it is allowed to do.
 *
 * The catalogue below is the shipped list of reclaimable space. Users add
 * their own entries, which live in the configuration and are never touched
 * by an update.
 *
 * Every removal in Jarek goes through `validateTarget`, and nothing else
 * removes anything. The rules it enforces are deliberately blunt: inside the
 * home directory, never a folder people keep their own files in, never a
 * symlink, never a path with "..". A rule that cannot pass is not cleaned,
 * whoever wrote it.
 */

import { execFile } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, isAbsolute, join, resolve, sep } from "node:path";

/** Entries smaller than this are not worth a question. */
export const MIN_SIZE_KB = 1024;
/** A node_modules folder has to be this big before it is offered. */
export const MIN_PROJECT_KB = 102_400;

/**
 * safe     rebuilt by the app itself, removed for good
 * review   frees a lot but costs something, routed to the Trash
 * leftover tools that are no longer installed, removed for good
 * projects node_modules found in the user's own folders, routed to the Trash
 */
export const GROUPS = ["safe", "review", "leftover", "projects"];

/** Where a group's items end up. Rebuildable things go; the rest stays recoverable. */
export function destinationFor(group) {
  return group === "review" || group === "projects" ? "trash" : "delete";
}

const AS = "~/Library/Application Support";
const LC = "~/Library/Caches";

/**
 * A rule is { id, group, label, path, command, process, note }.
 *
 * `path` is a string, or { darwin, linux } when the two systems disagree.
 * `command` replaces the plain removal: the tool cleans up after itself.
 * `process` is an app that must be closed first, `note` a key in the locale.
 */
export const CATALOG = [
  { id: "brew", group: "safe", label: "Homebrew", path: { darwin: `${LC}/Homebrew`, linux: "~/.cache/Homebrew" }, command: "brew cleanup --prune=all", note: "brew" },
  { id: "npm", group: "safe", label: "npm", path: "~/.npm/_cacache", command: "npm cache clean --force" },
  { id: "uv", group: "safe", label: "uv", path: { darwin: `${LC}/uv`, linux: "~/.cache/uv" }, command: "uv cache clean" },
  { id: "pip", group: "safe", label: "pip", path: { darwin: `${LC}/pip`, linux: "~/.cache/pip" } },
  { id: "node-gyp", group: "safe", label: "node-gyp", path: { darwin: `${LC}/node-gyp`, linux: "~/.cache/node-gyp" } },
  { id: "playwright", group: "safe", label: "Playwright", path: { darwin: `${LC}/ms-playwright`, linux: "~/.cache/ms-playwright" }, note: "playwright" },
  { id: "playwright-go", group: "safe", label: "Playwright (Go)", path: { darwin: `${LC}/ms-playwright-go`, linux: "~/.cache/ms-playwright-go" }, note: "playwright" },
  { id: "chrome", group: "safe", label: "Google Chrome", path: `${LC}/Google`, process: "Google Chrome", note: "chrome" },
  { id: "spotify", group: "safe", label: "Spotify", path: `${LC}/com.spotify.client`, process: "Spotify", note: "spotify" },
  { id: "discord", group: "safe", label: "Discord · Cache", path: `${AS}/discord/Cache`, process: "Discord" },
  { id: "discord-code", group: "safe", label: "Discord · Code Cache", path: `${AS}/discord/Code Cache`, process: "Discord" },
  { id: "discord-gpu", group: "safe", label: "Discord · GPUCache", path: `${AS}/discord/GPUCache`, process: "Discord" },
  { id: "notion", group: "safe", label: "Notion · Cache", path: `${AS}/Notion/Cache`, process: "Notion" },
  { id: "notion-assets", group: "safe", label: "Notion · notionAssetCache-v2", path: `${AS}/Notion/notionAssetCache-v2`, process: "Notion" },
  { id: "notion-code", group: "safe", label: "Notion · Code Cache", path: `${AS}/Notion/Code Cache`, process: "Notion" },
  { id: "claude", group: "safe", label: "Claude · Cache", path: `${AS}/Claude/Cache`, process: "Claude" },
  { id: "claude-code", group: "safe", label: "Claude · Code Cache", path: `${AS}/Claude/Code Cache`, process: "Claude" },
  { id: "vscode", group: "safe", label: "VS Code · Cache", path: `${AS}/Code/Cache`, process: "Code" },
  { id: "vscode-code", group: "safe", label: "VS Code · Code Cache", path: `${AS}/Code/Code Cache`, process: "Code" },
  { id: "vscode-data", group: "safe", label: "VS Code · CachedData", path: `${AS}/Code/CachedData`, process: "Code" },
  { id: "vscode-vsix", group: "safe", label: "VS Code · CachedExtensionVSIXs", path: `${AS}/Code/CachedExtensionVSIXs`, process: "Code" },
  { id: "vscode-logs", group: "safe", label: "VS Code · logs", path: `${AS}/Code/logs`, process: "Code" },
  { id: "postman", group: "safe", label: "Postman · Cache", path: `${AS}/Postman/Cache`, process: "Postman" },
  { id: "xcode-derived", group: "safe", label: "Xcode · DerivedData", path: "~/Library/Developer/Xcode/DerivedData", process: "Xcode", note: "xcode" },

  { id: "claude-vm", group: "review", label: "Claude · vm_bundles", path: `${AS}/Claude/vm_bundles`, process: "Claude", note: "claudeVm" },
  { id: "vscode-workspace", group: "review", label: "VS Code · workspaceStorage", path: `${AS}/Code/User/workspaceStorage`, process: "Code", note: "vscodeWorkspace" },
  { id: "simulators", group: "review", label: "iOS simulators", path: "~/Library/Developer/CoreSimulator/Devices", command: "xcrun simctl delete unavailable", note: "simulators" },

  { id: "copilot", group: "leftover", label: "GitHub Copilot CLI", path: "~/.copilot" },
  { id: "gemini", group: "leftover", label: "Gemini CLI", path: "~/.gemini" },
  { id: "codex", group: "leftover", label: "OpenAI Codex CLI", path: "~/.codex" },
  { id: "continuum", group: "leftover", label: "Anaconda", path: "~/.continuum" },
  { id: "dotnet", group: "leftover", label: ".NET SDK", path: "~/.dotnet", note: "dotnet" },
  { id: "nuget", group: "leftover", label: "NuGet", path: "~/.nuget", note: "nuget" },
  { id: "mono", group: "leftover", label: "Mono", path: "~/.mono" },
  { id: "android", group: "leftover", label: "Android SDK", path: "~/.android", note: "android" },
  { id: "wdm", group: "leftover", label: "WebDriver Manager", path: "~/.wdm", note: "wdm" },
  { id: "thumbnails", group: "leftover", label: "Thumbnails", path: "~/.thumbnails", note: "thumbnails" },
];

/** Entries that only make sense on a Mac: everything under ~/Library. */
function runsHere(rule, platform = process.platform) {
  const path = rulePath(rule, platform);
  if (!path) return false;
  if (platform === "darwin") return true;
  return !path.startsWith("~/Library");
}

/** The path for this system, still in ~ form, or "" when there is none. */
export function rulePath(rule, platform = process.platform) {
  const path = rule?.path;
  if (typeof path === "string") return path;
  if (path && typeof path === "object") return path[platform === "win32" ? "win32" : platform] ?? path.linux ?? "";
  return "";
}

export function catalogFor(platform = process.platform) {
  return CATALOG.filter((rule) => runsHere(rule, platform));
}

/** Where the user's own project folders are looked for. */
export const DEFAULT_PROJECT_PATHS = ["~/Developer", "~/Documents", "~/Desktop"];

/* ------------------------------------------------------------------ paths */

export function expandHome(target, home = homedir()) {
  const text = String(target ?? "").trim();
  if (text === "~") return home;
  if (text.startsWith("~/")) return join(home, text.slice(2));
  return text;
}

export function shortenHome(target, home = homedir()) {
  const text = String(target ?? "");
  return text === home || text.startsWith(home + sep) ? `~${text.slice(home.length)}` : text;
}

/**
 * Folders that hold the user's own things, or that everything else hangs off.
 * Their contents may be cleaned; they themselves never are. This is what
 * stops an empty variable in `join(dir, name)` from resolving to the parent.
 */
const PROTECTED = [
  "",
  "Applications", "Desktop", "Documents", "Downloads", "Developer", "Movies", "Music", "Pictures", "Public",
  "Library", "Library/Caches", "Library/Application Support", "Library/Containers", "Library/Developer",
  "Library/Preferences", "Library/Mobile Documents",
  ".Trash", ".ssh", ".gnupg", ".config", ".local", ".cache", ".npm", ".git",
];

export function protectedPaths(home = homedir()) {
  return new Set(PROTECTED.map((name) => (name ? join(home, name) : home)));
}

function inside(home, path) {
  return path !== home && path.startsWith(home + sep);
}

function realOrSame(path) {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

/**
 * The home directory written both ways: as it is handed to us, and as the
 * disk really sees it. On macOS /tmp is /private/tmp, and a home can sit on
 * another volume behind a link, so a single spelling would call the user's
 * own files "outside".
 */
function homeForms(home) {
  const real = realOrSame(home);
  return real === home ? [home] : [home, real];
}

/**
 * The single gate every removal passes through. Returns { ok: true, path }
 * with the resolved absolute path, or { ok: false, reason } with one of:
 * empty, relative, traversal, outside, protected, missing, symlink.
 */
export function validateTarget(target, { home = homedir(), mustExist = true } = {}) {
  const raw = String(target ?? "").trim();
  if (!raw) return { ok: false, reason: "empty" };

  const expanded = expandHome(raw, home);
  if (!isAbsolute(expanded)) return { ok: false, reason: "relative" };
  // Both separators: Windows accepts "/" too, and a path is refused for what
  // it says, not for how it was spelled.
  if (expanded.split(/[\\/]/).includes("..")) return { ok: false, reason: "traversal" };

  const path = resolve(expanded);
  const roots = homeForms(home);
  const isOutside = (target) => !roots.some((root) => inside(root, target));
  const isProtected = (target) => roots.some((root) => protectedPaths(root).has(target));

  if (isProtected(path)) return { ok: false, reason: "protected" };
  if (isOutside(path)) return { ok: false, reason: "outside" };

  if (!existsSync(path)) return mustExist ? { ok: false, reason: "missing" } : { ok: true, path };

  // A symlink is followed by nothing here: removing it would either delete the
  // link and free nothing, or, followed, reach outside all of these checks.
  if (lstatSync(path).isSymbolicLink()) return { ok: false, reason: "symlink" };

  // The parents may still be links. Judge where the path really lands.
  let real = path;
  try {
    real = realpathSync(path);
  } catch {
    return { ok: false, reason: "missing" };
  }
  if (isOutside(real)) return { ok: false, reason: "outside" };
  if (isProtected(real)) return { ok: false, reason: "protected" };

  return { ok: true, path };
}

/* ------------------------------------------------------------------ sizes */

function run(command, args, timeout = 20_000) {
  return new Promise((resolve) => {
    execFile(command, args, { timeout, windowsHide: true, maxBuffer: 8 << 20 }, (error, stdout) =>
      resolve(error && !stdout ? null : String(stdout)),
    );
  });
}

/** Size in KB, the way `du` counts it: what the disk actually gives back. */
export async function measureSize(path) {
  const output = await run("du", ["-sk", path]);
  const kb = Number(String(output ?? "").trim().split(/\s+/)[0]);
  return Number.isFinite(kb) ? kb : 0;
}

export async function isRunning(name) {
  if (!name) return false;
  const output = await run("pgrep", ["-x", name], 3000);
  return Boolean(String(output ?? "").trim());
}

/** Free space on the volume holding the home directory, in KB. */
export async function freeSpaceKb(home = homedir()) {
  const output = await run("df", ["-k", home], 5000);
  const line = String(output ?? "").trim().split("\n")[1] ?? "";
  const free = Number(line.split(/\s+/)[3]);
  return Number.isFinite(free) ? free : 0;
}

export function formatSize(kb) {
  const value = Number(kb) || 0;
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)}G`;
  if (value >= 1024) return `${Math.round(value / 1024)}M`;
  return `${Math.round(value)}K`;
}

/** Runs `work` over `items`, a few at a time, keeping the order of the input. */
async function mapLimit(items, limit, work) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Measures every rule and keeps the ones worth showing: the folder exists and
 * holds something, or the rule runs a command and has nothing to measure.
 */
export async function scanRules(rules, { home = homedir(), platform = process.platform } = {}) {
  const candidates = rules
    .map((rule) => ({ rule, path: expandHome(rulePath(rule, platform), home) }))
    .filter((item) => item.path && (existsSync(item.path) || (!rulePath(item.rule, platform) && item.rule.command)));

  const measured = await mapLimit(candidates, 8, async ({ rule, path }) => {
    const kb = existsSync(path) ? await measureSize(path) : 0;
    return { rule, path, kb, running: await isRunning(rule.process) };
  });

  return measured
    .filter((item) => item.kb >= MIN_SIZE_KB || (item.rule.command && item.kb === 0))
    .sort((a, b) => b.kb - a.kb);
}

/** node_modules folders in the user's own project folders, biggest first. */
export async function findProjects(paths, { home = homedir(), minKb = MIN_PROJECT_KB } = {}) {
  const roots = paths.map((path) => expandHome(path, home)).filter((path) => existsSync(path));
  if (roots.length === 0) return [];

  const output = await run("find", [...roots, "-type", "d", "-name", "node_modules", "-prune"], 30_000);
  const found = String(output ?? "").split("\n").map((line) => line.trim()).filter(Boolean);

  const measured = await mapLimit(found, 8, async (path) => ({ path, kb: await measureSize(path) }));
  return measured.filter((item) => item.kb >= minKb).sort((a, b) => b.kb - a.kb);
}

/**
 * The biggest folders that no rule covers, shown for information only.
 * This is how a new cache gets noticed before anyone writes a rule for it.
 */
export async function hiddenSpace({ home = homedir(), platform = process.platform, minKb = 204_800, limit = 8, known = [] } = {}) {
  const parents = platform === "darwin"
    ? [join(home, "Library", "Caches"), join(home, "Library", "Application Support"), join(home, "Library", "Containers")]
    : [join(home, ".cache"), join(home, ".local", "share")];

  const children = [];
  for (const parent of [...parents, home]) {
    if (!existsSync(parent)) continue;
    try {
      for (const entry of readdirSync(parent, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        // In the home directory itself, only the hidden folders: the rest is the user's.
        if (parent === home && !entry.name.startsWith(".")) continue;
        children.push(join(parent, entry.name));
      }
    } catch {
      // An unreadable folder is simply not reported.
    }
  }

  // A folder a rule already covers is not news: it is in the report above.
  const covered = new Set(known.map((path) => resolve(expandHome(path, home))));
  const rest = children.filter((path) => !covered.has(path));

  const measured = await mapLimit(rest, 8, async (path) => ({ path, kb: await measureSize(path) }));
  return measured.filter((item) => item.kb >= minKb).sort((a, b) => b.kb - a.kb).slice(0, limit);
}

/* --------------------------------------------------------------- removing */

function trashDir(home) {
  if (process.platform === "darwin") return { files: join(home, ".Trash") };
  const base = process.env.XDG_DATA_HOME || join(home, ".local", "share");
  return { files: join(base, "Trash", "files"), info: join(base, "Trash", "info") };
}

/** "Cache", then "Cache 2", "Cache 3": never overwrites what is already there. */
function freeName(folder, name) {
  if (!existsSync(join(folder, name))) return name;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${name} ${n}`;
    if (!existsSync(join(folder, candidate))) return candidate;
  }
  return `${name} ${Date.now()}`;
}

/**
 * Moves a path to the Trash, so a mistake costs a restore and not a backup.
 * Returns false when the Trash is on another volume: the caller then says so
 * instead of quietly deleting.
 */
export function moveToTrash(path, home = homedir()) {
  const { files, info } = trashDir(home);
  try {
    mkdirSync(files, { recursive: true });
    const name = freeName(files, basename(path));
    renameSync(path, join(files, name));
    if (info) {
      // The freedesktop Trash keeps the original location beside the file.
      mkdirSync(info, { recursive: true });
      const stamp = new Date().toISOString().replace(/\.\d+Z$/, "");
      writeFileSync(join(info, `${name}.trashinfo`), `[Trash Info]\nPath=${path}\nDeletionDate=${stamp}\n`, "utf8");
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Removes one target and reports what happened:
 * { ok, action: "trashed" | "deleted", reason? }.
 * `mode` is "trash" or "delete"; a Trash that cannot be reached falls back to
 * nothing at all, never to a silent delete.
 */
export function removeTarget(target, { home = homedir(), mode = "delete" } = {}) {
  const check = validateTarget(target, { home });
  if (!check.ok) return { ok: false, reason: check.reason };

  if (mode === "trash") {
    return moveToTrash(check.path, home) ? { ok: true, action: "trashed" } : { ok: false, reason: "trash" };
  }

  try {
    rmSync(check.path, { recursive: true, force: true });
    return { ok: true, action: "deleted" };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/* ------------------------------------------------------------ user rules */

const RESERVED_WORDS = new Set(["add", "new", "edit", "delete", "remove", "list", "reset", "scan", "safe",
  "aggiungi", "nuova", "nuovo", "modifica", "elimina", "rimuovi", "lista", "elenco", "azzera", "sicure"]);

export function isReservedWord(word) {
  return RESERVED_WORDS.has(String(word ?? "").trim().toLowerCase());
}

/** A user rule gets an id of its own so it can never collide with a shipped one. */
export function ruleId(label, existing = []) {
  const slug = String(label ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "rule";
  const taken = new Set(existing);
  let id = `my-${slug}`;
  for (let n = 2; taken.has(id); n += 1) id = `my-${slug}-${n}`;
  return id;
}

/** Keeps only what a rule is allowed to hold, in the shape the catalogue uses. */
export function normalizeRule(input, existing = []) {
  const label = String(input?.label ?? "").trim();
  if (!label) return null;

  const path = String(input?.path ?? "").trim();
  const command = String(input?.command ?? "").trim();
  if (!path && !command) return null;

  const group = GROUPS.includes(input?.group) && input.group !== "projects" ? input.group : "safe";
  const rule = { id: input?.id || ruleId(label, existing), group, label };
  if (path) rule.path = path;
  if (command) rule.command = command;

  const process = String(input?.process ?? "").trim();
  if (process) rule.process = process;
  const text = String(input?.text ?? "").trim();
  if (text) rule.text = text;

  return rule;
}

/** The clean section of the configuration, with every field guaranteed. */
export function cleanConfig(config) {
  const section = config?.clean && typeof config.clean === "object" ? config.clean : {};
  return {
    rules: Array.isArray(section.rules) ? section.rules.filter((rule) => normalizeRule(rule)) : [],
    skip: Array.isArray(section.skip) ? section.skip.filter((id) => typeof id === "string") : [],
    projectPaths: Array.isArray(section.projectPaths) && section.projectPaths.length > 0
      ? section.projectPaths.filter((path) => typeof path === "string")
      : DEFAULT_PROJECT_PATHS,
  };
}

/** The shipped catalogue plus the user's own, minus whatever they muted. */
export function activeRules(config, platform = process.platform) {
  const { rules, skip } = cleanConfig(config);
  const muted = new Set(skip);
  const mine = rules.map((rule) => normalizeRule(rule)).filter(Boolean).filter((rule) => runsHere(rule, platform));
  return [...catalogFor(platform), ...mine].filter((rule) => !muted.has(rule.id));
}
