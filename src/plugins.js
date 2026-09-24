/**
 * Commands of your own.
 *
 * Anything in ~/.config/jarek/plugins/*.js is loaded at startup and added to
 * the command list, so a command you wrote lives outside this package: it is
 * never published, never committed here, and survives reinstalling Jarek.
 *
 *   // ~/.config/jarek/plugins/home.js
 *   export default {
 *     name: "home",
 *     about: "turns the lights off and locks up",
 *     run: async (args, ctx) => ctx.ui.line("  good night"),
 *   };
 *
 * A file may export one command as the default, several as `commands`, and
 * screensavers as `animations`, which `break <name>` then plays.
 * A broken plugin is reported and skipped: it can delay Jarek, never stop it.
 */

import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { configPath } from "./config.js";

/** How long a plugin gets to load before Jarek moves on without it. */
const LOAD_TIMEOUT_MS = 2000;

export function pluginsPath() {
  return join(dirname(configPath()), "plugins");
}

/** The files to try, sorted, so the order is the same on every machine. */
export function pluginFiles(folder = pluginsPath()) {
  try {
    return readdirSync(folder, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".js") && !entry.name.startsWith("."))
      .map((entry) => join(folder, entry.name))
      .sort();
  } catch {
    return []; // no folder, no plugins: the normal case
  }
}

/**
 * Keeps what a command needs and nothing else, so a typo in a plugin cannot
 * quietly replace part of Jarek. Returns null when the shape is wrong.
 */
export function asCommand(value, { taken = new Set() } = {}) {
  if (!value || typeof value !== "object") return null;

  const name = String(value.name ?? "").trim().toLowerCase();
  if (!/^[a-z][a-z0-9-]*$/.test(name) || taken.has(name)) return null;
  if (typeof value.run !== "function") return null;

  const aliases = (Array.isArray(value.aliases) ? value.aliases : [])
    .map((alias) => String(alias).trim().toLowerCase())
    .filter((alias) => /^[a-z][a-z0-9-]*$/.test(alias) && alias !== name && !taken.has(alias));

  return {
    name,
    aliases,
    run: value.run,
    fullscreen: value.fullscreen === true,
    exits: value.exits === true,
    mine: true, // marks it in the menu as one of yours
    usage: String(value.usage ?? name),
    about: String(value.about ?? ""),
  };
}

/** An animation only needs a name and something to run; `break` gives it the screen. */
export function asAnimation(value) {
  if (!value || typeof value !== "object") return null;
  const name = String(value.name ?? "").trim().toLowerCase();
  if (!/^[a-z][a-z0-9-]*$/.test(name) || typeof value.run !== "function") return null;
  return { name, about: String(value.about ?? ""), run: value.run };
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

/**
 * Loads every plugin and returns { commands, animations, problems }. `taken`
 * holds the names already in use, which a plugin is not allowed to take over.
 */
export async function loadPlugins({ folder = pluginsPath(), taken = new Set() } = {}) {
  const commands = [];
  const animations = [];
  const problems = [];
  const claimed = new Set(taken);

  for (const file of pluginFiles(folder)) {
    let module;
    try {
      // A cache-busting query keeps a re-read honest during a long session.
      module = await withTimeout(import(`${pathToFileURL(file).href}?t=${Date.now()}`), LOAD_TIMEOUT_MS);
    } catch (error) {
      problems.push({ file, reason: error?.message ?? String(error) });
      continue;
    }

    const exported = Array.isArray(module.commands) ? module.commands : [module.default];
    let added = 0;
    for (const candidate of exported) {
      const command = asCommand(candidate, { taken: claimed });
      if (!command) continue;
      claimed.add(command.name);
      for (const alias of command.aliases) claimed.add(alias);
      commands.push(command);
      added += 1;
    }

    for (const candidate of Array.isArray(module.animations) ? module.animations : []) {
      const animation = asAnimation(candidate);
      if (!animation) continue;
      animations.push(animation);
      added += 1;
    }

    if (added === 0) problems.push({ file, reason: "no command" });
  }

  return { commands, animations, problems };
}
