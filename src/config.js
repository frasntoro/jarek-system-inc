/**
 * The user's configuration: how to address them, the city, music, protocols.
 *
 * It lives in its own file under the platform's config directory. The old
 * ~/.jarekrc from the Ollama era is deliberately ignored and left untouched.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const CONFIG_VERSION = 1;

export function configPath() {
  const home = homedir();
  const base =
    process.platform === "win32"
      ? process.env.APPDATA || join(home, "AppData", "Roaming")
      : process.env.XDG_CONFIG_HOME || join(home, ".config");
  return join(base, "jarek", "config.json");
}

export function defaultConfig() {
  return { version: CONFIG_VERSION, title: { kind: "sir" }, city: null, sound: true, voice: true, theme: "instagram", protocols: {} };
}

/** Returns null when there is no configuration yet (or it is unreadable). */
export function loadConfig() {
  try {
    const data = JSON.parse(readFileSync(configPath(), "utf8"));
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const defaults = defaultConfig();
    return {
      ...defaults,
      ...data,
      title: { ...defaults.title, ...data.title },
      protocols: data.protocols && typeof data.protocols === "object" ? data.protocols : {},
    };
  } catch {
    return null;
  }
}

/** Writes atomically, so an interrupted save never leaves a broken file. */
export function saveConfig(config) {
  const file = configPath();
  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  writeFileSync(temporary, `${JSON.stringify({ ...config, version: CONFIG_VERSION }, null, 2)}\n`, "utf8");
  renameSync(temporary, file);
  return file;
}

/** "~/.config/jarek/config.json" reads better than the absolute path. */
export function displayPath(file) {
  const home = homedir();
  return file.startsWith(home) ? `~${file.slice(home.length)}` : file;
}

/**
 * The music the boot sequence plays under Jarek's voice: the user's own file,
 * when they set one in "startupSound" and it exists, otherwise `fallback`,
 * the track shipped with Jarek. A custom track stays on the user's machine and
 * is never part of the package.
 */
export function startupSound(config, fallback) {
  const custom = typeof config?.startupSound === "string" ? config.startupSound.trim() : "";
  if (!custom) return fallback;
  const path = custom === "~" || custom.startsWith("~/") ? join(homedir(), custom.slice(1)) : custom;
  return existsSync(path) ? path : fallback;
}
