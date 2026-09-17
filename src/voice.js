/**
 * Jarek's spoken lines: short recordings made with the "Daniel" voice of
 * Kokoro-82M (Apache 2.0), played at a few chosen moments. English only, by
 * design. They follow how the user is addressed (sir, ma'am, or no title for a
 * name, which cannot be pre-recorded) and stay silent when the voice or sound
 * is switched off.
 */

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { playSound } from "./audio.js";
import { timeOfDay } from "./i18n.js";

export const VOICE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "voice");

/** Lines recorded once per title. */
const TITLED = new Set(["focus-done", "bye"]);
const isTitled = (line) => TITLED.has(line) || line === "intro-welcome";

export function voiceClip(line, config) {
  if (!isTitled(line)) return line;
  const kind = config?.title?.kind ?? "sir";
  if (kind === "sir") return `${line}-sir`;
  if (kind === "madam") return `${line}-madam`;
  return line;
}

export function voiceEnabled(ctx) {
  return ctx.config?.voice !== false && ctx.options?.sound !== false;
}

/** Plays a line and returns the player handle, or null when nothing plays. */
export function speak(line, ctx) {
  if (!voiceEnabled(ctx)) return null;
  const file = join(VOICE_DIR, `${voiceClip(line, ctx.config)}.wav`);
  return existsSync(file) ? playSound(file) : null;
}

/* ------------------------------------------------------------------- intro */

const RAIN = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
const SNOW = new Set([71, 73, 75, 77, 85, 86]);

/** "Welcome back, sir. All systems will be prepared in a few minutes." */
export function introGreeting() {
  return "intro-welcome";
}

/**
 * The second line of the intro. Normally it fits the hour — a cup of coffee in
 * the morning, a short break in the afternoon, and a good evening or night —
 * but weather worth mentioning takes its place when it has arrived in time.
 */
export function introRemark(date, weather) {
  if (weather?.now) {
    const { code, feelsLike } = weather.now;
    const imperial = weather.degree === "°F";
    if (RAIN.has(code)) return "intro-rain-now";
    if (SNOW.has(code)) return "intro-snow-now";
    if (Number.isFinite(feelsLike) && feelsLike <= (imperial ? 37 : 3)) return "intro-cold";
    if (Number.isFinite(feelsLike) && feelsLike >= (imperial ? 90 : 32)) return "intro-hot";
  }
  return `intro-${timeOfDay(date.getHours())}`;
}
