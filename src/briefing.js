/**
 * The payoff: what JARVIS actually says once the systems are up. Lines appear
 * one at a time, paced slowly enough to read, and anything that failed to load
 * is simply left out rather than reported as an error.
 */

import { formatUptime } from "./system.js";
import { closingFor, describeWeather, greetingFor } from "./i18n.js";
import { gradientText, gray, line, sleep, terminalWidth, truncate, white, isInteractive } from "./ui.js";

const LINE_DELAY_MS = 260;

/** Headlines arrive at any length; a briefing line has to stay one line. */
function headlineRoom() {
  return Math.max(40, Math.min(96, terminalWidth() - 6));
}

function formatClock(date, locale) {
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatDate(date, locale) {
  return new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(date);
}

function placeLabel(location) {
  if (!location) return null;
  const parts = [location.city || location.region, location.country].filter(Boolean);
  return parts.join(", ");
}

export async function printBriefing({ data, strings, locale, lang }) {
  const now = new Date();
  const pause = async () => {
    if (isInteractive) await sleep(LINE_DELAY_MS);
  };

  line(gradientText(greetingFor(now.getHours(), strings)));
  line(white(strings.briefing.clock(formatClock(now, locale), formatDate(now, locale))));
  await pause();

  const { location, weather, news, system, offline } = data;

  if (weather && location) {
    const place = placeLabel(location);
    const degree = weather.degree;
    line();
    line(gray(place));
    line(
      white(
        strings.briefing.now(
          `${weather.now.temperature}${degree}`,
          describeWeather(weather.now.code, lang),
          `${weather.now.feelsLike}${degree}`,
        ),
      ),
    );
    await pause();
    if (Number.isFinite(weather.tomorrow.min) && Number.isFinite(weather.tomorrow.max)) {
      line(
        gray(
          strings.briefing.tomorrow(
            `${weather.tomorrow.min}${degree}`,
            `${weather.tomorrow.max}${degree}`,
            weather.tomorrow.rainChance,
          ),
        ),
      );
      await pause();
    }
  } else if (offline) {
    line();
    line(gray(strings.briefing.offline));
    await pause();
  } else if (!location) {
    line();
    line(gray(strings.briefing.noLocation));
    await pause();
  }

  if (news?.length) {
    line();
    line(white(strings.briefing.headlines));
    const room = headlineRoom();
    for (const headline of news) {
      line(`  ${gradientText("•")} ${gray(truncate(headline, room))}`);
      await pause();
    }
  }

  if (system) {
    line();
    line(
      gray(
        strings.briefing.diagnostics(
          formatUptime(system.uptimeSeconds),
          system.memoryFreeGb,
          system.memoryTotalGb,
        ),
      ),
    );
    await pause();
  }

  line();
  line(gradientText(closingFor(now.getHours(), strings)));
  line();
}
