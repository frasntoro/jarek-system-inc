/**
 * Everything a command needs to know about the session, in one object:
 * language, configuration, and the strings already personalised with the
 * user's title and drawn in the user's colours.
 */

import { defaultConfig, saveConfig } from "./config.js";
import { getStrings, personalize, titleFor, unitsFor } from "./i18n.js";
import { themePalette } from "./themes.js";
import { setPalette } from "./ui.js";

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
