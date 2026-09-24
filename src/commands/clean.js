/**
 * `clean` — the space you do not see, reviewed one entry at a time.
 *
 *   clean              the report, then a question per entry
 *   clean --scan       the report only, nothing is touched
 *   clean --safe       clears the caches that rebuild themselves, no questions
 *   clean add          add an entry of your own, guided
 *   clean edit         change one of yours
 *   clean delete       remove one of yours
 *   clean list         everything Jarek knows, yours included
 *   clean reset        start proposing the entries you muted again
 *
 * Caches that an app rebuilds by itself are removed for good: the Trash would
 * hold on to the space they were meant to give back. Everything else goes to
 * the Trash, so a wrong answer costs a restore.
 */

import { spawn } from "node:child_process";
import { homedir } from "node:os";

import {
  activeRules,
  cleanConfig,
  destinationFor,
  expandHome,
  findProjects,
  formatSize,
  freeSpaceKb,
  hiddenSpace,
  isReservedWord,
  isRunning,
  measureSize,
  normalizeRule,
  removeTarget,
  rulePath,
  scanRules,
  shortenHome,
  validateTarget,
} from "../cleanup.js";
import { askLine, yesNo } from "../prompts.js";
import {
  amber,
  clearLine,
  gradientText,
  gray,
  green,
  isInteractive,
  line,
  red,
  terminalWidth,
  truncate,
  white,
  write,
} from "../ui.js";

const COMMAND_TIMEOUT_MS = 180_000;
const GROUP_ORDER = ["safe", "leftover", "review", "projects"];
const WORDS = {
  add: ["add", "new", "aggiungi", "nuova", "nuovo", "crea"],
  edit: ["edit", "modifica", "cambia"],
  delete: ["delete", "remove", "elimina", "rimuovi"],
  list: ["list", "lista", "elenco"],
  reset: ["reset", "azzera", "ripristina"],
  scan: ["scan", "--scan", "--dry-run", "report"],
  safe: ["safe", "--safe", "sicure"],
};

function wordIs(kind, word) {
  return WORDS[kind].includes(String(word ?? "").toLowerCase());
}

/** The user's own entries, in the order they were added. */
function myRules(ctx) {
  return cleanConfig(ctx.config).rules.map((rule) => normalizeRule(rule)).filter(Boolean);
}

function saveClean(ctx, changes) {
  const current = cleanConfig(ctx.config);
  ctx.save({ clean: { ...current, ...changes } });
}

/* ------------------------------------------------------------------ report */

function printGroup(ctx, title, items, total) {
  if (items.length === 0) return;
  const s = ctx.strings.clean;
  line();
  line(`  ${white(title)}  ${amber(formatSize(total))}`);
  for (const item of items) {
    const label = item.rule ? item.rule.label : shortenHome(item.path.replace(/\/node_modules$/, ""));
    const open = item.running ? amber(`  ${s.open}`) : "";
    line(`    ${gray(formatSize(item.kb).padStart(7))}  ${truncate(label, terminalWidth() - 20)}${open}`);
  }
}

function groupTitle(ctx, group) {
  return ctx.strings.clean.groups[group];
}

async function collect(ctx, { withHidden }) {
  const home = homedir();
  const rules = activeRules(ctx.config);
  const { projectPaths } = cleanConfig(ctx.config);

  const [scanned, projects] = await Promise.all([
    scanRules(rules, { home }),
    findProjects(projectPaths, { home }),
  ]);
  const hidden = withHidden ? await hiddenSpace({ home, known: rules.map((rule) => rulePath(rule)) }) : [];

  const groups = Object.fromEntries(GROUP_ORDER.map((group) => [group, []]));
  for (const item of scanned) groups[item.rule.group]?.push(item);
  groups.projects = projects.map((project) => ({ ...project, rule: null }));

  const totals = Object.fromEntries(
    GROUP_ORDER.map((group) => [group, groups[group].reduce((sum, item) => sum + item.kb, 0)]),
  );
  return { groups, totals, hidden, total: Object.values(totals).reduce((sum, kb) => sum + kb, 0) };
}

/* ----------------------------------------------------------------- cleaning */

function runCommand(command) {
  return new Promise((resolve) => {
    const shell = process.env.SHELL || "/bin/sh";
    let child;
    try {
      child = spawn(shell, ["-ic", command], { stdio: "ignore", windowsHide: true });
    } catch {
      resolve(false);
      return;
    }
    const timer = setTimeout(() => {
      child.kill();
      resolve(false);
    }, COMMAND_TIMEOUT_MS);
    child.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve(code === 0);
    });
  });
}

/** Does the thing, and says which thing it did. */
async function cleanItem(ctx, item) {
  const s = ctx.strings.clean;
  const group = item.rule?.group ?? "projects";

  if (item.rule?.command) {
    return (await runCommand(item.rule.command)) ? green(`    ${s.done}`) : red(`    ${s.failed}`);
  }

  const result = removeTarget(item.path, { mode: destinationFor(group) });
  if (result.ok) return green(`    ${result.action === "trashed" ? s.trashed : s.done}`);
  return red(`    ${s.refused(s.reasons[result.reason] ?? result.reason)}`);
}

/**
 * The questions. "Enter" keeps the entry, a yes cleans it, and "never" means
 * Jarek stops offering it: the muted list is the user's, never the catalogue's.
 */
async function askEach(ctx, items, { auto }) {
  const s = ctx.strings.clean;
  const muted = [];

  for (const item of items) {
    const label = item.rule ? item.rule.label : shortenHome(item.path);
    const group = item.rule?.group ?? "projects";
    const note = item.rule?.note ? s.notes[item.rule.note] : item.rule?.text;

    line();
    line(`  ${white(label)}  ${amber(formatSize(item.kb))}`);
    line(gray(`  ${shortenHome(item.rule?.command ? item.rule.command : item.path)}`));
    if (note) line(gray(`  ${note}`));
    if (destinationFor(group) === "trash") line(gray(`  ${s.goesToTrash}`));

    if (item.rule?.process && (await isRunning(item.rule.process))) {
      line(amber(`    ${s.appOpen(item.rule.process)}`));
      continue;
    }

    if (!auto) {
      const answer = await askLine(ctx, s.askItem, s.askItemHint);
      if (answer === null) {
        line(gray(`    ${s.stopped}`));
        break;
      }
      if (s.neverWords.includes(answer.trim().toLowerCase())) {
        if (item.rule) muted.push(item.rule.id);
        line(gray(`    ${s.muted}`));
        continue;
      }
      if (!yesNo(answer, false)) {
        line(gray(`    ${s.skipped}`));
        continue;
      }
    }

    line(await cleanItem(ctx, item));
  }

  if (muted.length > 0) {
    const { skip } = cleanConfig(ctx.config);
    saveClean(ctx, { skip: [...new Set([...skip, ...muted])] });
  }
}

async function runClean(ctx, mode) {
  const s = ctx.strings.clean;
  const report = mode !== "safe";

  line();
  line(gradientText(`  ${s.header}`));
  line();
  if (isInteractive) write(gray(`  ${s.scanning}`));

  const before = await freeSpaceKb();
  const { groups, totals, hidden, total } = await collect(ctx, { withHidden: report });
  if (isInteractive) clearLine();

  if (report) {
    for (const group of GROUP_ORDER) printGroup(ctx, groupTitle(ctx, group), groups[group], totals[group]);
    if (total === 0) {
      line(gray(`  ${s.nothing}`));
      line();
      return;
    }
    line();
    line(`  ${gray(s.total)} ${amber(formatSize(total))}${gray("  ·  ")}${gray(s.safeTotal)} ${green(formatSize(totals.safe))}`);

    if (hidden.length > 0) {
      line();
      line(`  ${white(s.hiddenTitle)}`);
      for (const item of hidden) {
        line(`    ${gray(formatSize(item.kb).padStart(7))}  ${truncate(shortenHome(item.path), terminalWidth() - 20)}`);
      }
      line(gray(`  ${s.hiddenHint}`));
    }
    line();
  }

  if (mode === "scan") {
    line(gray(`  ${s.scanOnly}`));
    line();
    return;
  }

  if (mode === "ask") {
    if (!isInteractive) {
      line(gray(`  ${s.scanOnly}`));
      line();
      return;
    }
    const go = await askLine(ctx, s.proceed, s.noDefault);
    if (go === null || !yesNo(go, false)) {
      line(gray(`  ${s.cancelled}`));
      line();
      return;
    }
  }

  const order = mode === "safe" ? ["safe"] : GROUP_ORDER;
  for (const group of order) {
    if (groups[group].length === 0) continue;
    line();
    line(gradientText(`  ${groupTitle(ctx, group)}`));
    await askEach(ctx, groups[group], { auto: mode === "safe" });
  }

  const freed = Math.max(0, (await freeSpaceKb()) - before);
  line();
  line(`  ${green(s.freed)} ${white(formatSize(freed))}`);
  line(gray(`  ${s.freedHint}`));
  line();
}

/* ------------------------------------------------------------- user rules */

function printRuleList(ctx) {
  const s = ctx.strings.clean;
  const mine = myRules(ctx);
  const { skip, projectPaths } = cleanConfig(ctx.config);

  line();
  line(gradientText(`  ${s.listTitle}`));
  line();
  line(gray(`  ${s.builtIn(activeRules({}).length)}`));

  if (mine.length > 0) {
    line();
    line(`  ${white(s.mine)}`);
    mine.forEach((rule, index) => {
      const what = rule.command ? rule.command : shortenHome(rule.path);
      line(`    ${gray(`${index + 1}.`)} ${white(rule.label)}  ${gray(truncate(what, terminalWidth() - 30))}`);
    });
  } else {
    line();
    line(gray(`  ${s.noRules}`));
  }

  if (skip.length > 0) {
    line();
    line(`  ${white(s.mutedTitle)}  ${gray(skip.join(", "))}`);
    line(gray(`  ${s.resetHint}`));
  }

  line();
  line(gray(`  ${s.projectsIn(projectPaths.join("  "))}`));
  line(gray(`  ${s.listHint}`));
  line();
}

/** Asks the four questions a rule is made of. `current` prefills them. */
async function askRule(ctx, current = null) {
  const s = ctx.strings.clean;
  const keep = (value) => (value ? s.enterKeeps(value) : "");

  const label = await askLine(ctx, s.askLabel, keep(current?.label) || s.labelHint);
  if (label === null) return null;
  const name = label.trim() || current?.label || "";
  if (!name) return null;
  if (isReservedWord(name)) {
    line(red(`  ${s.reservedName(name)}`));
    return null;
  }

  const kindAnswer = await askLine(ctx, s.askKind, current?.command ? s.enterKeeps(s.kindCommand) : s.kindHint);
  if (kindAnswer === null) return null;
  const isCommand = kindAnswer.trim() ? /^(2|c|comando|command)/i.test(kindAnswer.trim()) : Boolean(current?.command);

  let path = current?.path ?? "";
  let command = current?.command ?? "";

  if (isCommand) {
    const typed = await askLine(ctx, s.askCommand, keep(current?.command));
    if (typed === null) return null;
    command = typed.trim() || current?.command || "";
    if (!command) return null;

    const measure = await askLine(ctx, s.askMeasure, keep(current?.path) || s.enterSkips);
    if (measure === null) return null;
    path = measure.trim() || current?.path || "";
  } else {
    command = "";
    const typed = await askLine(ctx, s.askPath, keep(current?.path) || s.pathHint);
    if (typed === null) return null;
    path = typed.trim() || current?.path || "";
    if (!path) return null;
  }

  if (path) {
    const check = validateTarget(path);
    if (!check.ok) {
      line(red(`  ${s.pathRefused(shortenHome(expandHome(path)), s.reasons[check.reason] ?? check.reason)}`));
      return null;
    }
    const kb = await measureSize(check.path);
    line(gray(`  ${s.pathSize(formatSize(kb))}`));
  }

  const rebuilds = await askLine(ctx, s.askRebuilds, current ? s.enterKeeps(current.group === "safe" ? s.yes : s.no) : s.yesDefault);
  if (rebuilds === null) return null;
  const group = yesNo(rebuilds, current ? current.group === "safe" : true) ? "safe" : "review";

  const process = await askLine(ctx, s.askProcess, keep(current?.process) || s.enterSkips);
  if (process === null) return null;

  const text = await askLine(ctx, s.askNote, keep(current?.text) || s.enterSkips);
  if (text === null) return null;

  return normalizeRule(
    {
      id: current?.id,
      label: name,
      group,
      path,
      command,
      process: process.trim() || current?.process || "",
      text: text.trim() || current?.text || "",
    },
    myRules(ctx).map((rule) => rule.id),
  );
}

function describeRule(ctx, rule) {
  const s = ctx.strings.clean;
  const what = rule.command ? rule.command : shortenHome(expandHome(rule.path));
  const where = s.groups[rule.group];
  return `${rule.label} · ${what} · ${where}`;
}

async function addRule(ctx, presetName) {
  const s = ctx.strings.clean;
  line();
  line(gradientText(`  ${s.addHeader}`));
  line(gray(`  ${s.addIntro}`));
  line();

  const rule = await askRule(ctx, presetName ? { label: presetName } : null);
  if (!rule) {
    line(gray(`  ${s.cancelled}`));
    line();
    return;
  }

  line();
  line(`  ${white(describeRule(ctx, rule))}`);
  const confirm = await askLine(ctx, s.confirmSave, s.yesDefault);
  if (confirm === null || !yesNo(confirm, true)) {
    line(gray(`  ${s.cancelled}`));
    line();
    return;
  }

  saveClean(ctx, { rules: [...myRules(ctx), rule] });
  line(green(`  ${s.saved(rule.label)}`));
  line();
}

/** Asks which of the user's entries to work on. Returns its index, or -1. */
async function pickRule(ctx, question) {
  const s = ctx.strings.clean;
  const mine = myRules(ctx);
  if (mine.length === 0) {
    line();
    line(gray(`  ${s.noRules}`));
    line(gray(`  ${s.addHint}`));
    line();
    return -1;
  }

  line();
  mine.forEach((rule, index) => line(`    ${gray(`${index + 1}.`)} ${white(rule.label)}  ${gray(describeRule(ctx, rule))}`));
  line();

  const answer = await askLine(ctx, question, s.byNumber);
  if (answer === null) return -1;
  const typed = answer.trim();
  const byNumber = Number(typed);
  if (Number.isInteger(byNumber) && byNumber >= 1 && byNumber <= mine.length) return byNumber - 1;
  const byName = mine.findIndex((rule) => rule.label.toLowerCase() === typed.toLowerCase());
  if (byName === -1) line(gray(`  ${s.notFound(typed)}`));
  return byName;
}

async function editRule(ctx) {
  const s = ctx.strings.clean;
  const index = await pickRule(ctx, s.askEdit);
  if (index === -1) return;

  const mine = myRules(ctx);
  const updated = await askRule(ctx, mine[index]);
  if (!updated) {
    line(gray(`  ${s.cancelled}`));
    line();
    return;
  }

  const rules = [...mine];
  rules[index] = { ...updated, id: mine[index].id };
  saveClean(ctx, { rules });
  line(green(`  ${s.saved(updated.label)}`));
  line();
}

async function deleteRule(ctx) {
  const s = ctx.strings.clean;
  const index = await pickRule(ctx, s.askDelete);
  if (index === -1) return;

  const mine = myRules(ctx);
  const answer = await askLine(ctx, s.confirmDelete(mine[index].label), s.noDefault);
  if (answer === null || !yesNo(answer, false)) {
    line(gray(`  ${s.cancelled}`));
    line();
    return;
  }

  saveClean(ctx, { rules: mine.filter((_, position) => position !== index) });
  line(green(`  ${s.deleted(mine[index].label)}`));
  line();
}

async function resetMuted(ctx) {
  const s = ctx.strings.clean;
  const { skip } = cleanConfig(ctx.config);
  line();
  if (skip.length === 0) {
    line(gray(`  ${s.resetNone}`));
    line();
    return;
  }
  saveClean(ctx, { skip: [] });
  line(green(`  ${s.resetDone(skip.length)}`));
  line();
}

/* ------------------------------------------------------------------ entry */

export async function clean(args, ctx) {
  const s = ctx.strings.clean;
  if (process.platform === "win32") {
    line();
    line(gray(`  ${s.unsupported}`));
    line();
    return;
  }

  const [word, ...rest] = args;
  if (wordIs("add", word)) return addRule(ctx, rest.join(" ").trim());
  if (wordIs("edit", word)) return editRule(ctx);
  if (wordIs("delete", word)) return deleteRule(ctx);
  if (wordIs("list", word)) return printRuleList(ctx);
  if (wordIs("reset", word)) return resetMuted(ctx);

  const mode = args.some((arg) => wordIs("scan", arg)) ? "scan" : args.some((arg) => wordIs("safe", arg)) ? "safe" : "ask";
  return runClean(ctx, mode);
}
