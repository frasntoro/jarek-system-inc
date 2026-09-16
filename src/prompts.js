/**
 * Small helpers shared by everything that asks the user a question.
 */

import { gray, white } from "./ui.js";

const YES = new Set(["s", "si", "sì", "y", "yes", "ok"]);
const NO = new Set(["n", "no"]);

/** "  Question? (hint) › " — resolves with the answer, or null if the user left. */
export function askLine(ctx, question, hint) {
  return ctx.ask(`  ${white(question)}${hint ? gray(` (${hint})`) : ""} ${gray("›")} `);
}

export function yesNo(answer, fallback) {
  const reply = String(answer ?? "").trim().toLowerCase();
  if (YES.has(reply)) return true;
  if (NO.has(reply)) return false;
  return fallback;
}
