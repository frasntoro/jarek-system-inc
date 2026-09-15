/**
 * Jarek speaks the language of the machine he runs on. The locale comes from
 * the environment (LC_ALL, LC_MESSAGES, LANG, LANGUAGE) and falls back to the
 * Intl runtime; English is used for anything not translated yet.
 *
 * Adding a language means adding one entry to STRINGS and one to WEATHER.
 */

import { execFileSync } from "node:child_process";

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
 * resolves to en-US. The real answer lives in the global preferences, so ask
 * for it, but only when the environment had nothing useful to say.
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
  const lang = STRINGS[requested] ? requested : FALLBACK;
  const locale = country ? `${lang}-${country}` : lang;
  return { locale, lang, country };
}

const WEATHER = {
  en: {
    0: "clear sky",
    1: "mainly clear",
    2: "partly cloudy",
    3: "overcast",
    45: "fog",
    48: "freezing fog",
    51: "light drizzle",
    53: "drizzle",
    55: "heavy drizzle",
    56: "freezing drizzle",
    57: "freezing drizzle",
    61: "light rain",
    63: "rain",
    65: "heavy rain",
    66: "freezing rain",
    67: "freezing rain",
    71: "light snow",
    73: "snow",
    75: "heavy snow",
    77: "snow grains",
    80: "light showers",
    81: "showers",
    82: "violent showers",
    85: "snow showers",
    86: "heavy snow showers",
    95: "thunderstorms",
    96: "thunderstorms with hail",
    99: "thunderstorms with hail",
  },
  it: {
    0: "cielo sereno",
    1: "poco nuvoloso",
    2: "parzialmente nuvoloso",
    3: "coperto",
    45: "nebbia",
    48: "nebbia ghiacciata",
    51: "pioviggine leggera",
    53: "pioviggine",
    55: "pioviggine intensa",
    56: "pioviggine gelata",
    57: "pioviggine gelata",
    61: "pioggia leggera",
    63: "pioggia",
    65: "pioggia intensa",
    66: "pioggia gelata",
    67: "pioggia gelata",
    71: "neve leggera",
    73: "neve",
    75: "neve intensa",
    77: "granuli di neve",
    80: "rovesci leggeri",
    81: "rovesci",
    82: "rovesci violenti",
    85: "rovesci di neve",
    86: "forti rovesci di neve",
    95: "temporali",
    96: "temporali con grandine",
    99: "temporali con grandine",
  },
};

export function describeWeather(code, lang = FALLBACK) {
  const table = WEATHER[lang] ?? WEATHER[FALLBACK];
  return table[code] ?? (WEATHER[FALLBACK][code] || "");
}

const STRINGS = {
  en: {
    boot: {
      core: "Initializing core systems",
      power: "Routing power to the arc reactor",
      coffee: "Brewing coffee, Sir",
      heuristics: "Calibrating heuristic algorithms",
      sector: "Mapping the local sector",
      uplink: "Establishing satellite uplink",
      atmosphere: "Reading atmospheric sensors",
      news: "Scanning global news feeds",
      chrome: "Polishing the chrome",
      diagnostics: "Running full diagnostics",
      workshop: "Warming up the workshop",
      final: "Final safety checks",
      online: "All systems online",
    },
    status: { ok: "OK", warn: "WARN", wait: "··", off: "OFF" },
    greeting: {
      morning: "Good morning, Sir.",
      afternoon: "Good afternoon, Sir.",
      evening: "Good evening, Sir.",
      night: "Still awake, Sir?",
    },
    briefing: {
      clock: (time, date) => `It is ${time} on ${date}.`,
      place: (place) => place,
      now: (temperature, description, feelsLike) =>
        `${temperature}, ${description}. Feels like ${feelsLike}.`,
      tomorrow: (min, max, rain) =>
        `Tomorrow: ${min} to ${max}${rain === null ? "" : `, ${rain}% chance of rain`}.`,
      headlines: "Headlines this hour:",
      diagnostics: (uptime, free, total) => `Local systems nominal — up ${uptime}, ${free} of ${total} GB free.`,
      closing: {
        morning: "Have a good day, Sir.",
        afternoon: "Enjoy the rest of your day, Sir.",
        evening: "Have a good evening, Sir.",
        night: "Have a good night, Sir.",
      },
      noLocation: "I could not fix your position, Sir.",
      noNews: "The news feeds are silent, Sir.",
      offline: "We are offline, Sir. Local systems only.",
    },
    help: {
      usage: "Usage: jarek [options]",
      options: [
        ["--city <name>", "brief on a specific city instead of your location"],
        ["--units <metric|imperial>", "temperature units (default: metric)"],
        ["--lang <code>", "override the language (en, it)"],
        ["--no-sound", "run the sequence without music"],
        ["--no-net", "skip weather and news, stay entirely local"],
        ["--fast", "skip the boot sequence, go straight to the briefing"],
        ["--no-color", "disable colour output"],
        ["-v, --version", "print the version"],
        ["-h, --help", "print this help"],
      ],
      hint: "Press any key during the sequence to skip ahead.",
    },
  },

  it: {
    boot: {
      core: "Avvio dei sistemi principali",
      power: "Energia al reattore arc",
      coffee: "Preparo il caffè, signore",
      heuristics: "Calibrazione degli algoritmi euristici",
      sector: "Mappatura del settore locale",
      uplink: "Collegamento satellitare",
      atmosphere: "Lettura dei sensori atmosferici",
      news: "Scansione dei notiziari globali",
      chrome: "Lucidatura delle superfici",
      diagnostics: "Diagnostica completa",
      workshop: "Riscaldamento dell'officina",
      final: "Controlli di sicurezza finali",
      online: "Tutti i sistemi sono operativi",
    },
    status: { ok: "OK", warn: "ATT", wait: "··", off: "OFF" },
    greeting: {
      morning: "Buongiorno, signore.",
      afternoon: "Buon pomeriggio, signore.",
      evening: "Buonasera, signore.",
      night: "Ancora sveglio, signore?",
    },
    briefing: {
      clock: (time, date) => `Sono le ${time} di ${date}.`,
      place: (place) => place,
      now: (temperature, description, feelsLike) =>
        `${temperature}, ${description}. Percepiti ${feelsLike}.`,
      tomorrow: (min, max, rain) =>
        `Domani: da ${min} a ${max}${rain === null ? "" : `, ${rain}% di probabilità di pioggia`}.`,
      headlines: "I titoli di quest'ora:",
      diagnostics: (uptime, free, total) =>
        `Sistemi locali nella norma — attivo da ${uptime}, ${free} GB liberi su ${total}.`,
      closing: {
        morning: "Le auguro una buona giornata, signore.",
        afternoon: "Le auguro un buon proseguimento di giornata, signore.",
        evening: "Le auguro una buona serata, signore.",
        night: "Le auguro una buona notte, signore.",
      },
      noLocation: "Non sono riuscito a rilevare la sua posizione, signore.",
      noNews: "I notiziari tacciono, signore.",
      offline: "Siamo offline, signore. Solo sistemi locali.",
    },
    help: {
      usage: "Uso: jarek [opzioni]",
      options: [
        ["--city <nome>", "briefing su una città specifica invece della sua posizione"],
        ["--units <metric|imperial>", "unità di temperatura (predefinito: metric)"],
        ["--lang <codice>", "forza la lingua (en, it)"],
        ["--no-sound", "esegue la sequenza senza musica"],
        ["--no-net", "salta meteo e notizie, resta in locale"],
        ["--fast", "salta la sequenza e va al briefing"],
        ["--no-color", "disattiva i colori"],
        ["-v, --version", "mostra la versione"],
        ["-h, --help", "mostra questo aiuto"],
      ],
      hint: "Premi un tasto durante la sequenza per saltare avanti.",
    },
  },
};

export function getStrings(lang = FALLBACK) {
  return STRINGS[lang] ?? STRINGS[FALLBACK];
}

function timeOfDay(hour) {
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
