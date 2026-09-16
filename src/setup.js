/**
 * Getting to know the user.
 *
 *   runSetup        the three questions of the very first run
 *   runPersonalize  `personalize`: a menu to change any setting later,
 *                   colours and protocols included
 *
 * Every question has a default that Enter accepts.
 */

import { configPath, displayPath } from "./config.js";
import { manageProtocols } from "./commands/protocol.js";
import { askLine, yesNo } from "./prompts.js";
import { locateByName } from "./sources/geo.js";
import { THEMES, parseThemeInput, themeLabel, themePalette } from "./themes.js";
import { amber, gradientText, gray, green, line, red, white } from "./ui.js";

const KINDS = ["sir", "madam", "name", "custom"];
const AUTOMATIC = new Set(["auto", "automatic", "automatica", "-"]);

/** Returned by a question when the user backed out (null is a real answer for the city). */
const CANCELLED = Symbol("cancelled");

/* -------------------------------------------------------------- questions */

async function askTitle(ctx) {
  const s = ctx.strings.setup;
  const current = ctx.config.title ?? { kind: "sir" };

  line(white(`  ${s.titleQuestion}`));
  s.titleOptions.forEach((option, index) => line(gray(`    ${index + 1}) ${option}`)));
  const currentIndex = Math.max(0, KINDS.indexOf(current.kind));
  let answer = await ctx.ask(`  ${gray(`(${s.enterKeeps(currentIndex + 1)}) ›`)} `);
  if (answer === null) return CANCELLED;

  let kind = KINDS[currentIndex];
  const picked = Number.parseInt(answer.trim(), 10);
  if (picked >= 1 && picked <= KINDS.length) kind = KINDS[picked - 1];
  if (kind !== "name" && kind !== "custom") return { kind };

  const previous = current.kind === kind ? current.value : "";
  answer = await askLine(ctx, kind === "name" ? s.nameQuestion : s.customQuestion, previous ? s.enterKeeps(previous) : null);
  if (answer === null) return CANCELLED;
  const value = answer.trim() || previous;
  return value ? { kind, value } : { kind: "sir" };
}

async function askCity(ctx) {
  const s = ctx.strings.setup;
  const current = ctx.config.city ?? null;

  const answer = await askLine(ctx, s.cityQuestion, s.enterKeeps(current || s.cityAuto));
  if (answer === null) return CANCELLED;

  const typed = answer.trim();
  if (!typed) return current;
  if (AUTOMATIC.has(typed.toLowerCase())) return null;

  try {
    const found = await locateByName(typed, { language: ctx.lang, timeout: 4000 });
    if (found) {
      line(green(`  ✓ ${s.cityFound([found.city, found.country].filter(Boolean).join(", "))}`));
      return found.city;
    }
    line(amber(`  ${s.cityNotFound(typed)}`));
    return null;
  } catch {
    // Offline: trust what was typed rather than throwing it away.
    line(amber(`  ${s.cityUnverified(typed)}`));
    return typed;
  }
}

async function askSound(ctx) {
  const s = ctx.strings.setup;
  const current = ctx.config.sound !== false;
  const answer = await askLine(ctx, s.soundQuestion, current ? s.yesDefault : s.noDefault);
  if (answer === null) return CANCELLED;
  return yesNo(answer, current);
}

async function askTheme(ctx) {
  const s = ctx.strings.theme;
  const names = Object.keys(THEMES);
  const current = themeLabel(ctx.config.theme, ctx.strings);

  line(white(`  ${s.question}`));
  names.forEach((name, index) => {
    const marker = name === current ? gray(`  ← ${s.current}`) : "";
    line(`    ${gray(`${index + 1})`)} ${white(name.padEnd(11))}${gradientText("█".repeat(18), THEMES[name])}${marker}`);
  });
  if (Array.isArray(ctx.config.theme)) {
    line(`    ${gray("·")}  ${white(current.padEnd(11))}${gradientText("█".repeat(18), themePalette(ctx.config.theme))}`);
  }
  line(gray(`    ${s.customHint}`));

  for (;;) {
    const answer = await ctx.ask(`  ${gray(`(${ctx.strings.setup.enterKeeps(current)}) ›`)} `);
    if (answer === null) return CANCELLED;
    const typed = answer.trim();
    if (!typed) return ctx.config.theme ?? "instagram";

    const picked = Number.parseInt(typed, 10);
    if (String(picked) === typed && picked >= 1 && picked <= names.length) return names[picked - 1];

    const theme = parseThemeInput(typed);
    if (theme) return theme;
    line(amber(`  ${s.invalid(typed)}`));
  }
}

/* ----------------------------------------------------------------- saving */

function save(ctx, changes) {
  try {
    return ctx.save(changes);
  } catch (error) {
    line(red(`  ${ctx.strings.setup.saveFailed(error.message)}`));
    return null;
  }
}

function cancelled(ctx) {
  line();
  line(gray(`  ${ctx.strings.setup.cancelled}`));
  line();
  return null;
}

/* ---------------------------------------------------------------- first run */

/** Resolves with the saved configuration, or null if the user backed out. */
export async function runSetup(ctx, { firstRun = false } = {}) {
  const s = ctx.strings.setup;
  line();
  line(gradientText(`  ${firstRun ? s.header : s.headerAgain}`));
  line(gray(`  ${s.intro}`));
  line();

  const title = await askTitle(ctx);
  if (title === CANCELLED) return cancelled(ctx);
  line();
  const city = await askCity(ctx);
  if (city === CANCELLED) return cancelled(ctx);
  line();
  const sound = await askSound(ctx);
  if (sound === CANCELLED) return cancelled(ctx);

  const file = save(ctx, { title, city, sound });
  if (!file) return null;

  line();
  line(gray(`  ${ctx.strings.setup.saved(displayPath(file))}`));
  line(gradientText(`  ${ctx.strings.setup.welcome}`));
  line(gray(`  ${ctx.strings.setup.later}`));
  line();
  return ctx.config;
}

/* ------------------------------------------------------------- personalize */

export async function runPersonalize(ctx) {
  for (;;) {
    const s = ctx.strings.personalize;
    const protocolCount = Object.keys(ctx.config.protocols ?? {}).length;
    const rows = [
      [s.items.title, ctx.title],
      [s.items.city, ctx.config.city || ctx.strings.setup.cityAuto],
      [s.items.sound, ctx.config.sound !== false ? s.on : s.off],
      [s.items.theme, themeLabel(ctx.config.theme, ctx.strings)],
      [s.items.protocols, s.protocolCount(protocolCount)],
    ];
    const width = Math.max(...rows.map(([label]) => label.length)) + 3;

    line();
    line(gradientText(`  ${s.header}`));
    line();
    rows.forEach(([label, value], index) => {
      line(`    ${gray(`${index + 1})`)} ${white(label.padEnd(width))}${gray(value)}`);
    });
    line();

    const answer = await askLine(ctx, s.question, s.enterExits);
    if (answer === null || !answer.trim()) {
      line(gray(`  ${s.fileHint(displayPath(configPath()))}`));
      line();
      return;
    }
    line();

    let value;
    switch (answer.trim()) {
      case "1":
        value = await askTitle(ctx);
        if (value !== CANCELLED && save(ctx, { title: value })) line(green(`  ✓ ${ctx.strings.personalize.saved}`));
        break;
      case "2":
        value = await askCity(ctx);
        if (value !== CANCELLED && save(ctx, { city: value })) line(green(`  ✓ ${ctx.strings.personalize.saved}`));
        break;
      case "3":
        value = await askSound(ctx);
        if (value !== CANCELLED && save(ctx, { sound: value })) line(green(`  ✓ ${ctx.strings.personalize.saved}`));
        break;
      case "4":
        value = await askTheme(ctx);
        if (value !== CANCELLED && save(ctx, { theme: value })) {
          // Saved and applied already: the confirmation is drawn in the new colours.
          line(gradientText(`  ✓ ${ctx.strings.theme.set(themeLabel(value, ctx.strings))}`));
        }
        break;
      case "5":
        await manageProtocols(ctx);
        break;
      default:
        line(amber(`  ${s.invalid}`));
    }
  }
}

/* ------------------------------------------------------------------ theme */

/** `theme [name | #hex #hex …]` — the shortcut to menu item 4. */
export async function runTheme(args, ctx) {
  const typed = args.join(" ").trim();
  line();

  if (!typed) {
    const value = await askTheme(ctx);
    if (value !== CANCELLED && save(ctx, { theme: value })) {
      line(gradientText(`  ✓ ${ctx.strings.theme.set(themeLabel(value, ctx.strings))}`));
    }
    line();
    return;
  }

  const theme = parseThemeInput(typed);
  if (!theme) {
    line(amber(`  ${ctx.strings.theme.invalid(typed)}`));
    line(gray(`  ${ctx.strings.theme.usage}`));
    line(gray(`  ${ctx.strings.theme.available(Object.keys(THEMES).join(", "))}`));
    line();
    return;
  }
  if (save(ctx, { theme })) {
    line(`  ${gradientText("█".repeat(24))}`);
    line(gradientText(`  ✓ ${ctx.strings.theme.set(themeLabel(theme, ctx.strings))}`));
  }
  line();
}
