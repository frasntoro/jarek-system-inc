/**
 * `bye` — the boot sequence in reverse: systems report OFF one by one while
 * the bar drains, then a line on today's commits and a farewell. The git
 * lookup runs during the animation and is abandoned if it takes too long.
 */

import { commitsToday } from "../sources/git.js";
import {
  center,
  clearLine,
  gradientText,
  gray,
  hideCursor,
  isInteractive,
  line,
  progressBar,
  showCursor,
  sleep,
  terminalWidth,
  white,
  write,
} from "../ui.js";

const STEP_MS = 420;
const SUMMARY_BUDGET_MS = 6000;

function projectList(repos, s) {
  const shown = repos.slice(0, 3).map((repo) => repo.name);
  const hidden = repos.length - shown.length;
  return shown.join(", ") + (hidden > 0 ? ` ${s.more(hidden)}` : "");
}

export async function bye(args, ctx) {
  const s = ctx.strings.bye;
  const summary = Promise.race([commitsToday(), sleep(SUMMARY_BUDGET_MS).then(() => null)]).catch(() => null);

  const tag = `${gray("[")}${gray(center(ctx.strings.status.off, 4))}${gray("]")}`;
  const barWidth = Math.min(34, terminalWidth() - 12);

  line();
  hideCursor();
  for (const [index, step] of s.steps.entries()) {
    if (isInteractive) clearLine();
    line(`  ${tag} ${white(step)}`);
    if (isInteractive) {
      write(`  ${progressBar(1 - (index + 1) / s.steps.length, barWidth)}`);
      await sleep(STEP_MS);
    }
  }
  if (isInteractive) clearLine();
  showCursor();

  const today = await summary;
  line();
  if (today) {
    line(white(`  ${today.total ? s.commits(today.total, today.repos.length, projectList(today.repos, s)) : s.noCommits}`));
  }
  line(gradientText(`  ${s.farewell}`));
  line();
}
