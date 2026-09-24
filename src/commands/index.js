/**
 * The command registry. Every command works both at the `jarek ❯` prompt and
 * straight from the shell (`jarek scan`). Names are English; aliases cover
 * Italian and a few natural synonyms, so people can type the word they think of.
 *
 * `fullscreen` commands read the keyboard themselves, so the prompt steps
 * aside while they run. `exits` ends the session afterwards.
 */

import { runPersonalize, runSetup, runTheme } from "../setup.js";
import { gradientText, gray, line, white } from "../ui.js";
import { bye } from "./bye.js";
import { clean } from "./clean.js";
import { focus } from "./focus.js";
import { breakCommand } from "./matrix.js";
import { protocol } from "./protocol.js";
import { scan } from "./scan.js";
import { newsCommand, weatherCommand } from "./weather.js";

export const COMMANDS = [
  { name: "focus", aliases: ["pomodoro"], fullscreen: true, run: focus },
  { name: "scan", aliases: ["diagnostica"], run: scan },
  { name: "clean", aliases: ["pulizia", "pulisci", "spazio", "cleanup"], run: clean },
  { name: "break", aliases: ["relax", "screensaver", "salvaschermo", "matrix"], fullscreen: true, run: breakCommand },
  { name: "weather", aliases: ["meteo"], run: weatherCommand },
  { name: "news", aliases: ["notizie"], run: newsCommand },
  { name: "protocol", aliases: ["protocollo", "protocols", "protocolli"], run: protocol },
  {
    name: "personalize",
    aliases: ["personalizza", "setup", "configura", "impostazioni", "settings"],
    // Before any configuration exists, start from the guided first-run questions.
    run: (args, ctx) => (ctx.firstRun ? runSetup(ctx, { firstRun: true }) : runPersonalize(ctx)),
  },
  { name: "theme", aliases: ["tema", "colore", "colori", "color", "colors"], run: runTheme },
  { name: "bye", aliases: ["exit", "quit", "esci", "ciao"], exits: true, run: bye },
  { name: "help", aliases: ["aiuto", "?"], hidden: true, run: (args, ctx) => printMenu(ctx) },
  { name: "clear", aliases: ["cls"], hidden: true, run: () => process.stdout.write("\x1b[2J\x1b[3J\x1b[H") },
];

/**
 * Adds a command of the user's own (see src/plugins.js). Built-in names win:
 * a plugin can extend Jarek, never quietly replace a piece of it.
 */
export function registerCommand(command) {
  if (!command?.name || typeof command.run !== "function") return false;
  if (findCommand(command.name)) return false;
  if (command.aliases?.some((alias) => findCommand(alias))) return false;
  COMMANDS.push({ aliases: [], ...command });
  return true;
}

export function findCommand(name) {
  const key = String(name).toLowerCase();
  return COMMANDS.find((command) => command.name === key || command.aliases.includes(key)) ?? null;
}

export function commandNames() {
  return COMMANDS.flatMap((command) => [command.name, ...command.aliases])
    .filter((name) => /^[a-z]/.test(name))
    .sort();
}

export function visibleCommands() {
  return COMMANDS.filter((command) => !command.hidden);
}

export function printMenu(ctx) {
  const s = ctx.strings;
  // A plugin brings its own words: there is no locale entry for it.
  const rows = visibleCommands().map(
    (command) => s.commands[command.name] ?? { usage: command.usage ?? command.name, about: command.about ?? "" },
  );
  const width = Math.max(...rows.map((row) => row.usage.length)) + 3;

  line();
  line(gradientText(`  ${s.repl.menu}`));
  line();
  for (const row of rows) line(`    ${white(row.usage.padEnd(width))}${gray(row.about)}`);
  line();
  line(gray(`  ${s.repl.hint}`));
  line();
}
