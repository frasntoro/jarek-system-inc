/**
 * `protocol` — lists of actions the user creates once and runs with one word.
 *
 *   protocol               list them, with their actions
 *   protocol <name>        run one
 *   protocol new [name]    create one, guided, no file editing needed
 *   protocol delete <name> remove one
 *
 * An action is stored in the configuration as one of:
 *
 *   { "label": "Open Google Chrome", "app": "Google Chrome" }
 *   { "label": "Open github.com", "open": "https://github.com/" }
 *   { "label": "Open ~/Documents", "open": "~/Documents" }
 *   { "label": "Run: npm run dev", "run": "npm run dev", "wait": false }
 *
 * Commands run through the user's own shell, so their aliases and functions
 * work exactly as in their terminal. `"wait": false` leaves long-running
 * processes (servers, watchers) running after Jarek has moved on.
 */

import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { configPath, displayPath } from "../config.js";
import { askLine, yesNo } from "../prompts.js";
import {
  amber,
  center,
  clearLine,
  gradientText,
  gray,
  green,
  isInteractive,
  line,
  red,
  sleep,
  truncate,
  white,
  write,
} from "../ui.js";

const STEP_TIMEOUT_MS = 120_000;
const BACKGROUND_GRACE_MS = 800;
const LAUNCHER_WAIT_MS = 5000;
const NEW_WORDS = new Set(["new", "nuovo", "crea", "create"]);
const DELETE_WORDS = new Set(["delete", "elimina", "rimuovi", "remove"]);

/* ------------------------------------------------------ reading the input */

function expandHome(target) {
  return target === "~" || target.startsWith("~/") ? homedir() + target.slice(1) : target;
}

/**
 * Turns what people type into a web address: "github.com" gains https://,
 * "localhost:3000" gains http://. Returns null for anything that is not one.
 */
export function normalizeSite(text) {
  const typed = String(text ?? "").trim();
  if (!typed || /\s/.test(typed)) return null;

  let candidate = typed;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(typed)) {
    candidate = /^(localhost|127\.0\.0\.1)(:|\/|$)/i.test(typed) ? `http://${typed}` : `https://${typed}`;
  }
  try {
    const url = new URL(candidate);
    if (!/^https?:$/.test(url.protocol)) return null;
    if (url.hostname !== "localhost" && !url.hostname.includes(".")) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Installed macOS apps, by name ("Google Chrome"), from the usual folders. */
function installedApps() {
  const folders = [
    "/Applications",
    "/Applications/Utilities",
    "/System/Applications",
    "/System/Applications/Utilities",
    join(homedir(), "Applications"),
  ];
  const names = new Set();
  for (const folder of folders) {
    try {
      for (const entry of readdirSync(folder)) if (entry.endsWith(".app")) names.add(entry.slice(0, -4));
    } catch {
      // Folder missing or unreadable.
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

/** An exact name wins; otherwise every app whose name contains what was typed. */
export function matchApps(typed, apps) {
  const wanted = String(typed ?? "").trim().toLowerCase();
  if (!wanted) return [];
  const exact = apps.filter((app) => app.toLowerCase() === wanted);
  if (exact.length) return exact;
  return apps.filter((app) => app.toLowerCase().includes(wanted));
}

/** What an action does, in words: its label, or one derived from it. */
export function describeStep(step, strings) {
  const labels = strings.protocol.labels;
  if (typeof step?.label === "string" && step.label.trim()) return step.label;
  if (typeof step?.app === "string") return labels.app(step.app);
  if (typeof step?.run === "string") return labels.run(step.run);
  if (typeof step?.open === "string") {
    const site = /^https?:\/\//i.test(step.open) ? normalizeSite(step.open) : null;
    return site ? labels.site(new URL(site).host) : labels.path(step.open);
  }
  return strings.protocol.invalidStep;
}

/* ---------------------------------------------------------------- running */

function shellFor(command) {
  if (process.platform === "win32") return [command, [], { shell: true }];
  const shell = process.env.SHELL || "/bin/sh";
  // Interactive, so the user's rc file loads and their aliases exist.
  return [shell, ["-ic", command], {}];
}

/**
 * Starts a launcher (open, start, xdg-open) and reports whether it worked.
 * Launchers exit quickly with a meaningful code; anything still running after
 * `grace` is assumed to have started fine and is left alone.
 */
function launch(command, args, grace = LAUNCHER_WAIT_MS) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, { stdio: "ignore", detached: true, windowsHide: true });
    } catch {
      resolve(false);
      return;
    }
    let settled = false;
    const settle = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ok);
    };
    const timer = setTimeout(() => {
      child.unref();
      settle(true);
    }, grace);
    child.on("error", () => settle(false));
    child.on("exit", (code) => settle(code === 0));
  });
}

function openTarget(target) {
  const resolved = /^[a-z][a-z0-9+.-]*:/i.test(target) ? target : expandHome(target);
  if (process.platform === "darwin") return launch("open", [resolved]);
  if (process.platform === "win32") return launch("cmd", ["/c", "start", "", resolved]);
  return launch("xdg-open", [resolved]);
}

function openApp(name) {
  if (process.platform === "darwin") return launch("open", ["-a", name]);
  if (process.platform === "win32") return launch("cmd", ["/c", "start", "", name]);
  // On Linux the app is its own command; it keeps running, so wait briefly.
  return launch(name.toLowerCase().replace(/\s+/g, "-"), [], BACKGROUND_GRACE_MS);
}

function runCommand(command, { wait = true } = {}) {
  return new Promise((resolve) => {
    const [file, args, extra] = shellFor(command);
    let child;
    try {
      child = spawn(file, args, { stdio: "ignore", detached: !wait, windowsHide: true, ...extra });
    } catch {
      resolve(false);
      return;
    }
    child.on("error", () => resolve(false));

    if (!wait) {
      // Give it a moment: a typo fails fast, a server keeps running.
      const grace = setTimeout(() => {
        child.unref();
        resolve(true);
      }, BACKGROUND_GRACE_MS);
      child.on("exit", (code) => {
        clearTimeout(grace);
        resolve(code === 0);
      });
      return;
    }

    const timeout = setTimeout(() => {
      child.kill();
      resolve(false);
    }, STEP_TIMEOUT_MS);
    child.on("exit", (code) => {
      clearTimeout(timeout);
      resolve(code === 0);
    });
  });
}

function performStep(step) {
  if (typeof step?.run === "string") return runCommand(step.run, { wait: step.wait !== false });
  if (typeof step?.app === "string") return openApp(step.app);
  if (typeof step?.open === "string") return openTarget(step.open);
  return Promise.resolve(false);
}

async function runProtocol(ctx, name) {
  const s = ctx.strings.protocol;
  const steps = ctx.config.protocols[name];
  if (!Array.isArray(steps)) {
    line(amber(`  ${s.invalid(name)}`));
    return;
  }

  const tag = (state) => {
    const label = center(ctx.strings.status[state], 4);
    const tint = state === "ok" ? green : state === "warn" ? amber : gray;
    return `${gray("[")}${tint(label)}${gray("]")}`;
  };

  line();
  line(gradientText(`  ${s.engaged(name.toUpperCase())}`));
  line();

  let warnings = 0;
  for (const step of steps) {
    const label = describeStep(step, ctx.strings);
    if (isInteractive) write(`  ${tag("wait")} ${white(label)}`);

    const ok = await performStep(step);
    if (!ok) warnings += 1;

    if (isInteractive) clearLine();
    line(`  ${tag(ok ? "ok" : "warn")} ${white(label)}`);
    if (isInteractive) await sleep(200);
  }

  line();
  line(gradientText(`  ${warnings ? s.completeWithWarnings(warnings) : s.complete}`));
  line();
}

/* --------------------------------------------------------------- creating */

const CANCEL = Symbol("cancel");
const SKIP = Symbol("skip");
const DONE = Symbol("done");

async function buildApp(ctx) {
  const s = ctx.strings.protocol;
  const apps = process.platform === "darwin" ? installedApps() : null;

  for (;;) {
    const answer = await askLine(ctx, s.askApp);
    if (answer === null) return CANCEL;
    const typed = answer.trim();
    if (!typed) return SKIP;
    // Elsewhere there is no reliable list of apps: trust the name.
    if (!apps) return { label: s.labels.app(typed), app: typed };

    const matches = matchApps(typed, apps);
    if (matches.length === 1) return { label: s.labels.app(matches[0]), app: matches[0] };
    if (matches.length > 1 && matches.length <= 9) {
      line(white(`  ${s.appChoose}`));
      matches.forEach((app, index) => line(gray(`    ${index + 1}) ${app}`)));
      const pick = await ctx.ask(`  ${gray("›")} `);
      if (pick === null) return CANCEL;
      const chosen = matches[Number.parseInt(pick.trim(), 10) - 1];
      if (chosen) return { label: s.labels.app(chosen), app: chosen };
      continue;
    }
    line(amber(`  ${matches.length ? s.appTooMany(matches.length) : s.appNotFound(typed)}`));
  }
}

async function buildSite(ctx) {
  const s = ctx.strings.protocol;
  for (;;) {
    const answer = await askLine(ctx, s.askSite);
    if (answer === null) return CANCEL;
    const typed = answer.trim();
    if (!typed) return SKIP;
    const url = normalizeSite(typed);
    if (url) return { label: s.labels.site(new URL(url).host), open: url };
    line(amber(`  ${s.siteInvalid(typed)}`));
  }
}

async function buildPath(ctx) {
  const s = ctx.strings.protocol;
  for (;;) {
    const answer = await askLine(ctx, s.askPath);
    if (answer === null) return CANCEL;
    const typed = answer.trim();
    if (!typed) return SKIP;
    if (existsSync(expandHome(typed))) return { label: s.labels.path(typed), open: typed };
    line(amber(`  ${s.pathMissing(typed)}`));
  }
}

async function buildCommand(ctx) {
  const s = ctx.strings.protocol;
  const answer = await askLine(ctx, s.askCommand);
  if (answer === null) return CANCEL;
  const command = answer.trim();
  if (!command) return SKIP;
  const background = await askLine(ctx, s.askBackground, ctx.strings.setup.noDefault);
  if (background === null) return CANCEL;
  return {
    label: s.labels.run(truncate(command, 48)),
    run: command,
    ...(yesNo(background, false) ? { wait: false } : {}),
  };
}

const BUILDERS = [
  ["app", buildApp],
  ["site", buildSite],
  ["path", buildPath],
  ["run", buildCommand],
];

async function askStep(ctx, number) {
  const s = ctx.strings.protocol;
  const menu = BUILDERS.map(([kind], index) => `${index + 1} ${s.kinds[kind]}`).join(" · ");
  const hint = number > 1 ? ` (${s.enterFinishes})` : "";
  line();

  for (;;) {
    const choice = await ctx.ask(`  ${white(s.stepHeader(number))} ${gray(`· ${menu}${hint} ›`)} `);
    if (choice === null) return CANCEL;
    const picked = choice.trim();
    if (!picked) return DONE;
    const builder = /^\d$/.test(picked) ? BUILDERS[Number(picked) - 1] : null;
    if (builder) return builder[1](ctx);
    line(amber(`  ${ctx.strings.personalize.invalid}`));
  }
}

/** The guided builder: a name, then one action at a time, then a recap. */
export async function createProtocol(ctx, presetName = "") {
  const s = ctx.strings.protocol;

  line();
  line(`  ${gradientText(s.newHeader)} ${gray(`· ${s.newIntro}`)}`);

  let name = presetName.trim();
  while (!name) {
    const answer = await askLine(ctx, s.askName);
    if (answer === null || !answer.trim()) return cancel(ctx);
    name = answer.trim();
    if (NEW_WORDS.has(name.toLowerCase()) || DELETE_WORDS.has(name.toLowerCase())) {
      line(amber(`  ${s.reservedName(name)}`));
      name = "";
    }
  }

  const existing = findName(ctx, name);
  if (existing) {
    const answer = await askLine(ctx, s.exists(existing), ctx.strings.setup.noDefault);
    if (answer === null || !yesNo(answer, false)) return cancel(ctx);
    name = existing;
  }

  const steps = [];
  for (;;) {
    const step = await askStep(ctx, steps.length + 1);
    if (step === CANCEL) return cancel(ctx);
    if (step === DONE) break;
    if (step === SKIP) continue;
    steps.push(step);
    line(green(`  ✓ ${step.label}`));
  }
  if (!steps.length) return cancel(ctx);

  line();
  line(`  ${white(`${name}:`)} ${gray(steps.map((step) => describeStep(step, ctx.strings)).join(" → "))}`);
  const confirm = await askLine(ctx, s.confirmSave, ctx.strings.setup.yesDefault);
  if (confirm === null || !yesNo(confirm, true)) return cancel(ctx);
  if (!saveProtocols(ctx, { ...ctx.config.protocols, [name]: steps })) return false;

  line(gradientText(`  ✓ ${s.saved(name)}`));

  // Seeing it work once is the best explanation of how to use it.
  const tryNow = await askLine(ctx, s.tryNow, ctx.strings.setup.yesDefault);
  if (tryNow !== null && yesNo(tryNow, true)) await runProtocol(ctx, name);
  else line();
  return true;
}

/* --------------------------------------------------------------- managing */

function findName(ctx, wanted) {
  const key = wanted.trim().toLowerCase();
  return Object.keys(ctx.config.protocols ?? {}).find((name) => name.toLowerCase() === key) ?? null;
}

function saveProtocols(ctx, protocols) {
  try {
    ctx.save({ protocols });
    return true;
  } catch (error) {
    line(red(`  ${ctx.strings.setup.saveFailed(error.message)}`));
    return false;
  }
}

function printList(ctx) {
  const s = ctx.strings.protocol;
  const protocols = ctx.config.protocols ?? {};
  const names = Object.keys(protocols);

  if (!names.length) {
    line(white(`  ${s.none}`));
    line(gray(`  ${s.createHint}`));
    return;
  }
  line(white(`  ${s.list}`));
  for (const name of names) {
    const steps = Array.isArray(protocols[name]) ? protocols[name] : [];
    line();
    line(`    ${gradientText("•")} ${white(name)} ${gray(`· ${s.steps(steps.length)}`)}`);
    steps.forEach((step, index) => line(gray(`        ${index + 1}. ${describeStep(step, ctx.strings)}`)));
  }
  line();
  line(gray(`  ${s.listHint}`));
}

export async function deleteProtocol(ctx, wanted = "") {
  const s = ctx.strings.protocol;
  if (!Object.keys(ctx.config.protocols ?? {}).length) {
    line(white(`  ${s.none}`));
    return false;
  }

  let typed = wanted.trim();
  if (!typed) {
    printList(ctx);
    line();
    const answer = await askLine(ctx, s.askDelete);
    if (answer === null || !answer.trim()) return false;
    typed = answer.trim();
  }

  const name = findName(ctx, typed);
  if (!name) {
    line(amber(`  ${s.notFound(typed)}`));
    return false;
  }
  const answer = await askLine(ctx, s.confirmDelete(name), ctx.strings.setup.noDefault);
  if (answer === null || !yesNo(answer, false)) return false;

  const { [name]: removed, ...rest } = ctx.config.protocols;
  if (!saveProtocols(ctx, rest)) return false;
  line(green(`  ✓ ${s.deleted(name)}`));
  return true;
}

/** Menu item 5 of `personalize`. */
export async function manageProtocols(ctx) {
  const s = ctx.strings.protocol;
  printList(ctx);
  line();
  line(gray(`    ${s.manageQuestion}`));
  const answer = await ctx.ask(`  ${gray(`(${ctx.strings.personalize.enterExits}) ›`)} `);
  if (answer === "1") await createProtocol(ctx);
  else if (answer === "2") await deleteProtocol(ctx);
}

function cancel(ctx) {
  line();
  line(gray(`  ${ctx.strings.protocol.cancelled}`));
  line();
  return false;
}

/* ---------------------------------------------------------------- command */

export async function protocol(args, ctx) {
  const [first = "", ...rest] = args;
  const word = first.toLowerCase();

  if (NEW_WORDS.has(word)) {
    await createProtocol(ctx, rest.join(" "));
    return;
  }
  if (DELETE_WORDS.has(word)) {
    line();
    await deleteProtocol(ctx, rest.join(" "));
    line();
    return;
  }

  const wanted = args.join(" ").trim();
  line();
  if (!wanted) {
    printList(ctx);
    line(gray(`  ${ctx.strings.personalize.fileHint(displayPath(configPath()))}`));
    line();
    return;
  }

  const name = findName(ctx, wanted);
  if (!name) {
    line(amber(`  ${ctx.strings.protocol.notFound(wanted)}`));
    printList(ctx);
    line();
    return;
  }
  await runProtocol(ctx, name);
}
