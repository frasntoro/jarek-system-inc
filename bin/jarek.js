#!/usr/bin/env node

/**
 * Jarek — entry point.
 *
 *   jarek              boot sequence, briefing, then a prompt awaiting commands
 *   jarek <command>    one command, no intro (jarek scan, jarek focus 25, …)
 *
 * The first interactive run starts with a short setup. Network work for the
 * briefing starts before the music does, and the sequence never waits for it.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { isQuietHour, playSound } from "../src/audio.js";
import { printBriefing } from "../src/briefing.js";
import { printLogo, runBootSequence, track } from "../src/boot.js";
import { MUSIC_FILE, QUIET_HOURS } from "../src/cues.js";
import { commandNames, findCommand, registerCommand, visibleCommands } from "../src/commands/index.js";
import { displayPath, loadConfig, startupSound } from "../src/config.js";
import { createContext } from "../src/context.js";
import { detectLocale } from "../src/i18n.js";
import { createReader, runRepl } from "../src/repl.js";
import { registerAnimation } from "../src/animations.js";
import { loadPlugins } from "../src/plugins.js";
import { runSetup } from "../src/setup.js";
import { resolveLocation } from "../src/sources/geo.js";
import { getHeadlines } from "../src/sources/news.js";
import { getWeather } from "../src/sources/weather.js";
import { getSystemInfo } from "../src/system.js";
import { introGreeting, introRemark, speak } from "../src/voice.js";
import { gradientText, gray, hideCursor, isInteractive, line, showCursor, white } from "../src/ui.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

/** Options come first; the first bare word is the command, the rest its arguments. */
function parseArgs(argv) {
  const options = {
    sound: true,
    music: false,
    net: true,
    fast: false,
    repl: true,
    city: null,
    units: null,
    lang: null,
    help: false,
    version: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("-")) return { options, command: arg, args: argv.slice(i + 1) };

    switch (arg) {
      case "--music":
        options.music = true;
        break;
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
      case "--no-repl":
      case "--once":
        options.repl = false;
        break;
      case "--city":
        options.city = argv[++i] ?? null;
        break;
      case "--units": {
        const units = argv[++i];
        options.units = units === "imperial" || units === "metric" ? units : null;
        break;
      }
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
  return { options, command: null, args: [] };
}

function printHelp(ctx) {
  const s = ctx.strings.help;
  const column = 26;
  line();
  line(gradientText(`Jarek v${pkg.version}`));
  line(gray(pkg.description));
  line();
  line(white(s.usage));
  line();
  line(white(s.commandsHeader));
  for (const command of visibleCommands()) {
    // A command of the user's own brings its own words, having no locale entry.
    const entry = ctx.strings.commands[command.name] ?? { usage: command.usage ?? command.name, about: command.about ?? "" };
    line(`  ${white(entry.usage.padEnd(column))} ${gray(entry.about)}`);
  }
  line();
  line(white(s.optionsHeader));
  for (const [flag, description] of s.options) line(`  ${white(flag.padEnd(column))} ${gray(description)}`);
  line();
  line(gray(s.hint));
  line();
}

async function playIntroAndBriefing(ctx) {
  const { options } = ctx;
  const offline = !options.net;
  const city = options.city ?? ctx.config.city ?? null;

  /* --- start the slow work first -------------------------------------- */

  const locationTask = track(offline ? Promise.resolve(null) : resolveLocation({ city, language: ctx.lang }));
  const weatherTask = track(
    locationTask.promise.then((location) => (location ? getWeather(location, { units: ctx.units }) : null)),
  );
  const newsTask = track(offline ? Promise.resolve(null) : getHeadlines({ language: ctx.lang }));
  const systemTask = track(Promise.resolve(getSystemInfo()));
  const tasks = { location: locationTask, weather: weatherTask, news: newsTask, system: systemTask };

  /* --- the show -------------------------------------------------------- */

  hideCursor();
  line();
  if (options.fast) {
    printLogo();
  } else {
    // The shipped track, or the user's own; never during the quiet hours unless --music asks for it.
    const quiet = !options.music && isQuietHour(new Date(), ctx.config.quietHours ?? QUIET_HOURS);
    const wantsMusic = options.sound && ctx.config.sound !== false && !quiet;
    const music = wantsMusic ? startupSound(ctx.config, join(root, "assets", MUSIC_FILE)) : null;
    await runBootSequence({
      strings: ctx.strings,
      tasks,
      offline,
      startAudio: music ? () => playSound(music) : null,
      voice: {
        greeting: () => speak(introGreeting(), ctx),
        // Chosen when it is spoken, so the weather has usually arrived by then.
        remark: () => speak(introRemark(new Date(), weatherTask.value), ctx),
      },
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
    strings: ctx.strings,
    locale: ctx.locale,
    lang: ctx.lang,
  });
  showCursor();
}

async function main() {
  const { options, command: commandName, args } = parseArgs(process.argv.slice(2));
  const { locale, lang, country } = detectLocale(options.lang);
  const ctx = createContext({ config: loadConfig(), lang, locale, country, options });

  if (options.version) {
    line(`jarek v${pkg.version}`);
    return 0;
  }
  // Commands of your own, from ~/.config/jarek/plugins, before anything is dispatched.
  const { commands: mine, animations, problems } = await loadPlugins({ taken: new Set(commandNames()) });
  for (const plugin of mine) registerCommand(plugin);
  for (const animation of animations) registerAnimation(animation);
  for (const problem of problems) line(gray(ctx.strings.repl.pluginFailed(displayPath(problem.file), problem.reason)));

  if (options.help) {
    printHelp(ctx);
    return 0;
  }

  const command = commandName ? findCommand(commandName) : null;
  if (commandName && !command) {
    line(gray(ctx.strings.repl.unknown(commandName)));
    return 1;
  }

  process.on("exit", () => showCursor());
  process.on("SIGINT", () => {
    showCursor();
    process.exit(130);
  });

  // Outside the prompt, questions get a reader created on demand.
  let reader = null;
  ctx.ask = (prompt) => {
    reader ??= createReader();
    return reader.ask(prompt);
  };
  const closeReader = () => {
    reader?.close();
    reader = null;
  };

  const interactive = isInteractive && Boolean(process.stdin.isTTY);

  // First run: get to know the person before anything else.
  if (ctx.firstRun && interactive && command?.name !== "personalize") {
    const saved = await runSetup(ctx, { firstRun: true });
    closeReader();
    if (!saved) return 130;
  }

  if (command) {
    await command.run(args, ctx);
    closeReader();
    return 0;
  }

  await playIntroAndBriefing(ctx);

  if (options.repl && interactive) await runRepl(ctx);
  else line();
  return 0;
}

main()
  .then((code) => process.exit(code ?? 0))
  .catch((error) => {
    showCursor();
    line(`\njarek: ${error?.message ?? error}\n`);
    process.exit(1);
  });
