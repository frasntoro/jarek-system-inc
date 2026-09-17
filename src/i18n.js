/**
 * Language, titles and time of day.
 *
 * Jarek speaks the language of the machine he runs on; the texts live in
 * src/locales, one file per language. Adding a language means adding a file
 * there and registering it in LOCALES.
 */

import { execFileSync } from "node:child_process";

import en from "./locales/en.js";
import it from "./locales/it.js";

const LOCALES = { en, it };
const FALLBACK = "en";

/** "C" and "POSIX" are the neutral locale: they name no language. */
function usable(tag) {
  if (!tag) return false;
  const head = tag.split(/[.:@]/)[0].toLowerCase();
  return head !== "" && head !== "c" && head !== "posix";
}

/**
 * macOS does not hand the system language to the shell — a terminal can report
 * LANG=C.UTF-8 on a Mac that is entirely in Italian, and Node's Intl then
 * resolves to en-US. The real answer lives in the global preferences.
 */
function systemLocale() {
  if (process.platform !== "darwin") return null;
  for (const key of ["AppleLocale", "AppleLanguages"]) {
    try {
      const value = execFileSync("defaults", ["read", "-g", key], {
        encoding: "utf8",
        timeout: 800,
        stdio: ["ignore", "pipe", "ignore"],
      });
      const match = value.match(/[A-Za-z]{2,3}[-_][A-Za-z]{2,4}|[A-Za-z]{2,3}/);
      if (match && usable(match[0])) return match[0];
    } catch {
      // No `defaults`, or no such key: try the next source.
    }
  }
  return null;
}

export function detectLocale(override) {
  /*
   * Order matters, and it is not the usual POSIX one.
   *
   * LC_ALL and LC_MESSAGES are always set deliberately by a person, so they
   * win. LANG is not: terminal emulators write it themselves, often as
   * C.UTF-8 or en_US.UTF-8, which says nothing about the language the machine
   * is configured in. On macOS the system language is a fact, so it outranks
   * LANG. Everywhere else LANG is the best signal available.
   *
   * Each source is a function: the system lookup only runs if it is reached.
   */
  const candidates = [
    () => override,
    () => process.env.LC_ALL,
    () => process.env.LC_MESSAGES,
    systemLocale,
    () => process.env.LANG,
    () => process.env.LANGUAGE,
    () => Intl.DateTimeFormat().resolvedOptions().locale,
  ];

  let raw = "en-US";
  for (const candidate of candidates) {
    const value = candidate();
    if (usable(value)) {
      raw = value;
      break;
    }
  }

  // "it_IT.UTF-8" and "it_IT:en_US" both need to become "it-IT".
  const cleaned = raw.split(/[.:@]/)[0].replace("_", "-");
  const [language, region] = cleaned.split("-");
  const requested = (language || FALLBACK).toLowerCase();
  const country = (region || "").toUpperCase();

  // When a language is not translated Jarek falls back to English completely:
  // an English briefing must not carry a French date or an Italian country
  // name. The region is kept, so "en-FR" still formats dates the local way.
  const lang = LOCALES[requested] ? requested : FALLBACK;
  const locale = country ? `${lang}-${country}` : lang;
  return { locale, lang, country };
}

export function getStrings(lang = FALLBACK) {
  return LOCALES[lang] ?? LOCALES[FALLBACK];
}

export function describeWeather(code, lang = FALLBACK) {
  const table = getStrings(lang).weather;
  return table[code] ?? LOCALES[FALLBACK].weather[code] ?? "";
}

/** The few countries that still measure temperature in Fahrenheit. */
export function unitsFor(country) {
  return ["US", "LR", "MM"].includes(country) ? "imperial" : "metric";
}

/** How Jarek addresses the user, from the configuration, in the given language. */
export function titleFor(config, lang = FALLBACK) {
  const title = config?.title ?? { kind: "sir" };
  if ((title.kind === "name" || title.kind === "custom") && title.value?.trim()) return title.value.trim();
  const titles = getStrings(lang).titles;
  return titles[title.kind] ?? titles.sir;
}

/**
 * Returns a copy of a strings tree with every "{title}" filled in, including
 * the text produced by string functions, so the rest of the code never has to
 * think about how the user wants to be addressed.
 */
export function personalize(value, title) {
  if (typeof value === "string") return value.replaceAll("{title}", title);
  if (typeof value === "function") return (...args) => personalize(value(...args), title);
  if (Array.isArray(value)) return value.map((item) => personalize(item, title));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, personalize(item, title)]));
  }
  return value;
}

export function timeOfDay(hour) {
  if (hour < 5) return "night";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

export function greetingFor(hour, strings) {
  return strings.greeting[timeOfDay(hour)];
}

/** The farewell runs on the same clock as the greeting that opened. */
export function closingFor(hour, strings) {
  return strings.briefing.closing[timeOfDay(hour)];
}
