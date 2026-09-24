/**
 * Everything a command needs to know about the session, in one object:
 * language, configuration, and the strings already personalised with the
 * user's title and drawn in the user's colours.
 */

import { defaultConfig, saveConfig } from "./config.js";
import { getStrings, personalize, titleFor, unitsFor } from "./i18n.js";
import { themePalette } from "./themes.js";
import {
  amber,
  clearLine,
  getPalette,
  gradientBlock,
  gradientText,
  gray,
  green,
  hideCursor,
  isInteractive,
  line,
  mix,
  paint,
  red,
  sample,
  setPalette,
  showCursor,
  sleep,
  terminalWidth,
  white,
  write,
} from "./ui.js";

export function createContext({ config, lang, locale, country, options }) {
  const ctx = {
    config: config ?? defaultConfig(),
    firstRun: !config,
    lang,
    locale,
    country,
    options,
    units: options.units ?? unitsFor(country),
    ask: null,
  };

  /**
   * What Jarek draws with, handed to commands the user wrote themselves, so a
   * plugin never has to reach inside this package for a file path.
   */
  ctx.ui = {
    line,
    write,
    paint,
    sample,
    mix,
    getPalette,
    gradientText,
    gradientBlock,
    gray,
    white,
    green,
    amber,
    red,
    clearLine,
    hideCursor,
    showCursor,
    isInteractive,
    terminalWidth,
    sleep,
  };

  /** Re-applies title and colours after the configuration changed. */
  ctx.refresh = () => {
    ctx.title = titleFor(ctx.config, lang);
    ctx.strings = personalize(getStrings(lang), ctx.title);
    setPalette(themePalette(ctx.config.theme));
  };

  /** Merges a change into the configuration, writes it and applies it. Throws if the write fails. */
  ctx.save = (changes) => {
    const next = { ...ctx.config, ...changes };
    const file = saveConfig(next);
    ctx.config = next;
    ctx.firstRun = false;
    ctx.refresh();
    return file;
  };

  ctx.refresh();
  return ctx;
}
