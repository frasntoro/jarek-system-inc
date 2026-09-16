/**
 * `weather [city]` and `news` — the briefing's blocks, on demand.
 *
 * The briefing keeps headlines to one line each. `news` is for reading: full
 * titles wrapped to the terminal, a short summary when the feed has one, and
 * who published it and how long ago.
 */

import { printWeather } from "../briefing.js";
import { resolveLocation } from "../sources/geo.js";
import { getStories } from "../sources/news.js";
import { getWeather } from "../sources/weather.js";
import { clearLine, dim, gradientText, gray, isInteractive, line, terminalWidth, white, wrap, write } from "../ui.js";

const STORY_COUNT = 6;
const SUMMARY_CHARACTERS = 320;

async function withSpinner(work) {
  if (isInteractive) write(gray("  ···"));
  try {
    return await work();
  } catch {
    return null;
  } finally {
    if (isInteractive) clearLine();
  }
}

export async function weatherCommand(args, ctx) {
  const s = ctx.strings.briefing;
  const city = args.join(" ").trim() || ctx.config.city || null;

  line();
  const result = await withSpinner(async () => {
    const location = await resolveLocation({ city, language: ctx.lang });
    if (!location) return { location: null, weather: null };
    const weather = await getWeather(location, { units: ctx.units }).catch(() => null);
    return { location, weather };
  });

  if (!result?.location) line(gray(`  ${city ? s.cityNotFound(city) : s.noLocation}`));
  else if (!result.weather) line(gray(`  ${s.noWeather}`));
  else await printWeather({ ...result, strings: ctx.strings, lang: ctx.lang, indent: "  " });
  line();
}

/** Shortens a summary at a word boundary. */
export function clip(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.]+$/, "")}…`;
}

/** "5 minutes ago", "3 ore fa", "yesterday" — in the user's language. */
export function timeAgo(timestamp, locale, now = Date.now()) {
  if (!timestamp) return null;
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const minutes = Math.round((now - timestamp) / 60_000);
  if (minutes < 60) return format.format(-Math.max(1, minutes), "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return format.format(-hours, "hour");
  return format.format(-Math.round(hours / 24), "day");
}

export async function newsCommand(args, ctx) {
  line();
  const stories = await withSpinner(() => getStories({ language: ctx.lang, limit: STORY_COUNT }));
  if (!stories?.length) {
    line(gray(`  ${ctx.strings.briefing.noNews}`));
    line();
    return;
  }

  line(gradientText(`  ${ctx.strings.news.header}`));
  const width = Math.max(30, Math.min(88, terminalWidth() - 10));
  const indent = "      ";

  stories.forEach((story, index) => {
    line();
    const [first, ...rest] = wrap(story.title, width);
    line(`  ${gradientText(String(index + 1).padStart(2))}  ${white(first)}`);
    for (const text of rest) line(`${indent}${white(text)}`);

    if (story.summary) {
      for (const text of wrap(clip(story.summary, SUMMARY_CHARACTERS), width)) line(`${indent}${gray(text)}`);
    }

    const meta = [story.source, timeAgo(story.published, ctx.locale)].filter(Boolean).join(" · ");
    if (meta) line(`${indent}${dim(gray(meta))}`);
  });
  line();
}
