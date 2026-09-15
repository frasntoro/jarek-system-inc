/**
 * The boot sequence: the part that has to feel good.
 *
 * Cues are scheduled against a single clock started with the music, never
 * chained one timeout after another, so a slow line can never drift out of
 * sync with the track. Lines whose work is real (location, weather, news)
 * report the true outcome, and a line that resolves after it was printed is
 * rewritten in place.
 */

import {
  amber,
  center,
  clearLine,
  gradientBlock,
  gradientText,
  gray,
  green,
  isInteractive,
  line,
  logoLines,
  moveDown,
  moveUp,
  progressBar,
  terminalWidth,
  truncate,
  white,
  write,
} from "./ui.js";
import { BRIEFING_AT, LOGO_AT, TIMELINE } from "./cues.js";

/** How often the progress bar is redrawn while the sequence plays. */
const BAR_TICK_MS = 70;

const TINTS = { ok: green, warn: amber, off: gray, wait: gray };

function statusTag(state, strings) {
  const label = center(strings.status[state] ?? strings.status.wait, 4);
  const tint = TINTS[state] ?? gray;
  return `${gray("[")}${tint(label)}${gray("]")}`;
}

/** Wraps a promise so its outcome can be read synchronously when a cue fires. */
export function track(promise) {
  const entry = { state: "pending", value: null };
  entry.promise = Promise.resolve(promise)
    .then((value) => {
      entry.state = value === null || value === undefined ? "warn" : "ok";
      entry.value = value ?? null;
      entry.onSettle?.(entry.state);
      return entry.value;
    })
    .catch(() => {
      entry.state = "warn";
      entry.onSettle?.("warn");
      return null;
    });
  return entry;
}

export async function runBootSequence({ strings, tasks, startAudio, offline = false }) {
  const started = Date.now();
  const elapsed = () => (Date.now() - started) / 1000;
  const audio = startAudio?.();

  let printedLines = 0; // status lines written so far, used to rewrite in place
  let barVisible = false;
  let skipped = false;
  let logoPrinted = false;
  let barTimer = null;

  const textRoom = () => Math.max(10, terminalWidth() - 12);

  const renderBar = () => {
    if (!isInteractive || skipped) return;
    clearLine();
    write(`  ${progressBar(Math.min(1, elapsed() / BRIEFING_AT), Math.min(34, terminalWidth() - 12))}`);
    barVisible = true;
  };

  const composeLine = (text, state) => `  ${statusTag(state, strings)} ${white(truncate(text, textRoom()))}`;

  const printStatusLine = (text, state) => {
    if (barVisible) clearLine();
    line(composeLine(text, state));
    printedLines += 1;
    renderBar();
  };

  /** Rewrites an already-printed status line without disturbing the scroll. */
  const rewriteStatusLine = (lineNumber, text, state) => {
    if (!isInteractive || skipped) return;
    const rowsUp = printedLines - lineNumber + (barVisible ? 1 : 0);
    if (rowsUp < 1 || rowsUp > 40) return;
    moveUp(rowsUp);
    clearLine();
    write(composeLine(text, state));
    moveDown(rowsUp);
    clearLine();
    renderBar();
  };

  const timers = [];
  const at = (seconds, action) => {
    const delay = Math.max(0, seconds * 1000 - (Date.now() - started));
    timers.push(setTimeout(action, delay));
  };

  let stopListeningForSkip = () => {};

  const finish = (wasSkipped) => {
    skipped = wasSkipped;
    for (const timer of timers) clearTimeout(timer);
    timers.length = 0;
    if (barTimer) {
      clearInterval(barTimer);
      barTimer = null;
    }
    if (barVisible) {
      clearLine();
      barVisible = false;
    }
    audio?.stop();
    stopListeningForSkip();
  };

  const sequence = new Promise((resolve) => {
    /* --- let the viewer cut the intro short --------------------------- */
    if (isInteractive && process.stdin.isTTY) {
      const onKey = (chunk) => {
        finish(true);
        if (chunk[0] === 3) {
          // Ctrl+C during the intro means "stop everything", not "skip".
          process.exit(130);
        }
        resolve({ skipped: true });
      };
      stopListeningForSkip = () => {
        process.stdin.off("data", onKey);
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        process.stdin.pause();
        stopListeningForSkip = () => {};
      };
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on("data", onKey);
    }

    at(LOGO_AT, () => {
      printLogo();
      logoPrinted = true;
      renderBar();
      // From here the bar advances on its own clock, not only when a cue fires.
      if (isInteractive) barTimer = setInterval(renderBar, BAR_TICK_MS);
    });

    for (const cue of TIMELINE) {
      at(cue.at, () => {
        const text = strings.boot[cue.key];
        const task = cue.task ? tasks[cue.task] : null;

        if (!task) {
          printStatusLine(text, "ok");
          return;
        }
        if (offline && cue.network) {
          printStatusLine(text, "off");
          return;
        }
        if (task.state !== "pending") {
          printStatusLine(text, task.state);
          return;
        }
        // Still in flight: show it working, then correct the line once it lands.
        const lineNumber = printedLines + 1;
        printStatusLine(text, "wait");
        task.onSettle = (state) => rewriteStatusLine(lineNumber, text, state);
      });
    }

    at(BRIEFING_AT, () => {
      finish(false);
      resolve({ skipped: false });
    });
  });

  const result = await sequence;

  // Skipping in the first instants should not cost the viewer the logo.
  if (!logoPrinted) {
    if (isInteractive) clearLine();
    printLogo();
  }

  // The bar is gone; leave one clean blank line before the briefing.
  if (isInteractive) clearLine();
  line();
  return result;
}

/** The logo, with the author's name set apart beneath it. */
export function printLogo() {
  for (const logoLine of gradientBlock(logoLines())) line(logoLine);
  line();
  line(gradientText("  by frasntoro"));
  line();
}
