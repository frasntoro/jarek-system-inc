#!/usr/bin/env node

/**
 * Jarek — entry point.
 *
 * Network work starts before the music does, so by the time a cue asks about
 * the weather the answer is usually already in hand. The sequence itself never
 * waits for it.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { AUDIO_FILE } from "../src/cues.js";
import { playSound } from "../src/audio.js";
import { printBriefing } from "../src/briefing.js";
import { printLogo, runBootSequence, track } from "../src/boot.js";
import { detectLocale, getStrings } from "../src/i18n.js";
import { getHeadlines } from "../src/sources/news.js";
import { getWeather } from "../src/sources/weather.js";
import { resolveLocation } from "../src/sources/geo.js";
import { getSystemInfo } from "../src/system.js";
import { gradientText, gray, hideCursor, line, showCursor, white } from "../src/ui.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

function parseArgs(argv) {
  const options = {
    sound: true,
    net: true,
    fast: false,
    city: null,
    units: "metric",
    lang: null,
    help: false,
    version: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--no-sound":
      case "--silent":
        options.sound = false;
        break;
      case "--no-net":
      case "--offline":
        options.net = false;
        break;
      case "--fast":
        options.fast = true;
        break;
      case "--city":
        options.city = argv[++i] ?? null;
        break;
      case "--units":
        options.units = argv[++i] === "imperial" ? "imperial" : "metric";
        break;
      case "--lang":
        options.lang = argv[++i] ?? null;
        break;
      case "--no-color":
        process.env.NO_COLOR = "1";
        break;
      case "-h":
      case "--help":
        options.help = true;
        break;
      case "-v":
      case "--version":
        options.version = true;
        break;
      default:
        break;
    }
  }
  return options;
}

function printHelp(strings) {
  line();
  line(gradientText(`Jarek v${pkg.version}`));
  line(gray(pkg.description));
  line();
  line(white(strings.help.usage));
  line();
  for (const [flag, description] of strings.help.options) {
    line(`  ${white(flag.padEnd(26))} ${gray(description)}`);
  }
  line();
  line(gray(strings.help.hint));
  line();
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { locale, lang } = detectLocale(options.lang);
  const strings = getStrings(lang);

  if (options.version) {
    line(`jarek v${pkg.version}`);
    return 0;
  }
  if (options.help) {
    printHelp(strings);
    return 0;
  }

  /* --- start the slow work first -------------------------------------- */

  const offline = !options.net;
  const locationTask = track(
    offline ? Promise.resolve(null) : resolveLocation({ city: options.city, language: lang }),
  );
  const weatherTask = track(
    locationTask.promise.then((location) => (location ? getWeather(location, { units: options.units }) : null)),
  );
  const newsTask = track(offline ? Promise.resolve(null) : getHeadlines({ language: lang }));
  const systemTask = track(Promise.resolve(getSystemInfo()));
  const tasks = { location: locationTask, weather: weatherTask, news: newsTask, system: systemTask };

  /* --- the show -------------------------------------------------------- */

  hideCursor();
  const restore = () => showCursor();
  process.on("exit", restore);
  process.on("SIGINT", () => {
    restore();
    process.exit(130);
  });

  line();
  if (options.fast) {
    printLogo();
  } else {
    await runBootSequence({
      strings,
      tasks,
      offline,
      startAudio: options.sound ? () => playSound(join(root, "assets", AUDIO_FILE)) : null,
    });
  }

  // Give anything still in flight a brief grace period before the briefing.
  await Promise.race([
    Promise.all([locationTask.promise, weatherTask.promise, newsTask.promise]),
    new Promise((resolve) => setTimeout(resolve, options.fast ? 4000 : 1200)),
  ]);

  await printBriefing({
    data: {
      location: locationTask.value,
      weather: weatherTask.value,
      news: newsTask.value,
      system: systemTask.value,
      offline,
    },
    strings,
    locale,
    lang,
  });

  showCursor();
  return 0;
}

main()
  .then((code) => process.exit(code ?? 0))
  .catch((error) => {
    showCursor();
    line(`\njarek: ${error?.message ?? error}\n`);
    process.exit(1);
  });
