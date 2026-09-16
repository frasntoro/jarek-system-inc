/**
 * After the briefing Jarek stays on duty: a prompt with history (arrow keys)
 * and Tab completion, waiting for commands until `bye`.
 */

import readline from "node:readline";

import { commandNames, findCommand, printMenu } from "./commands/index.js";
import { gradientText, gray, isInteractive, line, red } from "./ui.js";

let sharedHistory = [];

/**
 * A line reader that can be closed and recreated without losing history.
 * Commands that take over the keyboard (focus, matrix) need readline out of
 * the way; lines typed ahead of a prompt are queued rather than dropped.
 */
export function createReader({ completer } = {}) {
  const terminal = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal,
    history: sharedHistory,
    historySize: 200,
    removeHistoryDuplicates: true,
    completer,
  });

  const queued = [];
  const waiting = [];
  let closed = false;

  rl.on("line", (text) => {
    const resolve = waiting.shift();
    if (resolve) resolve(text);
    else queued.push(text);
  });
  // Ctrl+C at the prompt means "leave", like Ctrl+D.
  rl.on("SIGINT", () => rl.close());
  rl.on("close", () => {
    closed = true;
    if (Array.isArray(rl.history)) sharedHistory = rl.history;
    for (const resolve of waiting.splice(0)) resolve(null);
  });

  return {
    /** Resolves with the typed line, or null when input ends. */
    ask(prompt) {
      if (queued.length) return Promise.resolve(queued.shift());
      if (closed) return Promise.resolve(null);
      rl.setPrompt(prompt);
      rl.prompt();
      return new Promise((resolve) => waiting.push(resolve));
    },
    close() {
      if (!closed) rl.close();
    },
  };
}

function completer(text) {
  const typed = text.trimStart().toLowerCase();
  if (typed.includes(" ")) return [[], text];
  const names = commandNames();
  const hits = names.filter((name) => name.startsWith(typed));
  return [hits.length ? hits : names, text];
}

export async function runRepl(ctx) {
  let reader = createReader({ completer });
  ctx.ask = (prompt) => reader.ask(prompt);

  printMenu(ctx);
  // Built on every turn, so a theme change recolours the prompt immediately.
  const prompt = () => `${gradientText("jarek")} ${gray("❯")} `;

  for (;;) {
    const input = await reader.ask(prompt());
    if (input === null) {
      line();
      line(gradientText(`  ${ctx.strings.bye.farewell}`));
      line();
      break;
    }

    const [name, ...args] = input.trim().split(/\s+/);
    if (!name) continue;

    const command = findCommand(name);
    if (!command) {
      line(gray(`  ${ctx.strings.repl.unknown(name)}`));
      continue;
    }

    const takesKeyboard = command.fullscreen && isInteractive && Boolean(process.stdin.isTTY);
    if (takesKeyboard) reader.close();

    try {
      await command.run(args, ctx);
    } catch (error) {
      line(red(`  ${ctx.strings.repl.failed(error?.message ?? String(error))}`));
    }

    if (command.exits) break;
    if (takesKeyboard) reader = createReader({ completer });
  }

  reader.close();
}
