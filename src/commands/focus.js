/**
 * `focus [minutes]` — a pomodoro-style timer drawn with the boot sequence's
 * progress bar. Ends with a chime and a desktop notification; q, Esc or
 * Ctrl+C stop it early without leaving Jarek.
 */

import { playChime } from "../audio.js";
import { notify } from "../notify.js";
import { speak } from "../voice.js";
import {
  clearLine,
  gradientBlock,
  gradientText,
  gray,
  hideCursor,
  isInteractive,
  line,
  showCursor,
  terminalWidth,
  white,
  write,
} from "../ui.js";

const TICK_MS = 250;
const STOP_KEYS = new Set(["q", "Q", "\x1b", "\x03"]);

export function parseMinutes(argument) {
  if (argument === undefined) return 25;
  const minutes = Number(String(argument).replace(",", "."));
  return Number.isFinite(minutes) && minutes > 0 && minutes <= 600 ? minutes : null;
}

export function formatRemaining(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const pad = (value) => String(value).padStart(2, "0");
  return hours ? `${hours}:${pad(minutes)}:${pad(seconds % 60)}` : `${pad(minutes)}:${pad(seconds % 60)}`;
}

export async function focus(args, ctx) {
  const s = ctx.strings.focus;
  const minutes = parseMinutes(args[0]);
  if (minutes === null) {
    line(gray(`  ${s.invalid}`));
    return;
  }

  const total = Math.round(minutes * 60_000);
  const label = String(Math.round(minutes * 100) / 100);
  const interactive = isInteractive && Boolean(process.stdin.isTTY);

  line();
  line(gradientText(`  ${s.title(label)}`));
  if (interactive) line(gray(`  ${s.hint}`));
  line();

  const started = Date.now();
  const barWidth = Math.max(10, Math.min(40, terminalWidth() - 16));
  const render = (remaining) => {
    const done = Math.min(1, Math.max(0, 1 - remaining / total));
    const filled = Math.round(done * barWidth);
    const bar = gradientBlock(["█".repeat(filled)])[0] + gray("░".repeat(barWidth - filled));
    clearLine();
    write(`  ${bar}  ${white(formatRemaining(remaining))}`);
  };

  let outcome = "done";
  if (interactive) {
    hideCursor();
    outcome = await new Promise((resolve) => {
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearInterval(timer);
        process.stdin.off("data", onKey);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        resolve(result);
      };
      const onKey = (chunk) => {
        if (STOP_KEYS.has(chunk.toString())) finish("stopped");
      };
      const timer = setInterval(() => {
        const remaining = total - (Date.now() - started);
        if (remaining <= 0) finish("done");
        else render(remaining);
      }, TICK_MS);

      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on("data", onKey);
      render(total);
    });
  } else {
    // Without a terminal there is nothing to animate: just keep time.
    await new Promise((resolve) => setTimeout(resolve, total));
  }

  if (outcome === "done") {
    if (interactive) render(0);
    line();
    line();
    line(gradientText(`  ${s.done}`));
    if (!speak("focus-done", ctx)) playChime();
    notify(s.notifyTitle, s.notifyBody);
  } else {
    line();
    line();
    line(gray(`  ${s.stopped(formatRemaining(Date.now() - started))}`));
  }
  showCursor();
  line();
}
