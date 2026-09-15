/**
 * Headlines from an RSS feed, chosen by the language Jarek is speaking:
 * Italian gets European coverage, English gets the American edition.
 * The parsing is deliberately minimal: item titles only, no XML dependency.
 */

import { fetchText } from "../net.js";

const ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decode(text) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match)
    .replace(/\s+/g, " ")
    .trim();
}

/** Google News appends " - Publisher" to every title; it is noise in a briefing. */
function stripPublisher(title) {
  return title.replace(/\s+[-–]\s+[^-–]{2,40}$/, "").trim();
}

/**
 * One list per language, most wanted first; the rest are fallbacks used only
 * when a feed cannot be reached.
 *
 *   it → Euronews Italia: European news, in Italian
 *   en → Google News, United States edition
 */
const FEEDS = {
  it: [
    "https://it.euronews.com/rss?level=theme&name=news",
    "https://news.google.com/rss/headlines/section/topic/WORLD?hl=it&gl=IT&ceid=IT:it",
  ],
  en: [
    "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en",
    "https://feeds.npr.org/1001/rss.xml",
  ],
};

export function feedsFor(language = "en") {
  return FEEDS[(language || "en").toLowerCase()] ?? FEEDS.en;
}

function parseHeadlines(xml, limit) {
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  const headlines = [];
  for (const item of items) {
    const raw = item.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1];
    if (!raw) continue;
    const title = stripPublisher(decode(raw));
    if (title && !headlines.includes(title)) headlines.push(title);
    if (headlines.length >= limit) break;
  }
  return headlines.length ? headlines : null;
}

export async function getHeadlines({ feed, language = "en", limit = 3, timeout = 4000 } = {}) {
  for (const url of feed ? [feed] : feedsFor(language)) {
    try {
      const headlines = parseHeadlines(await fetchText(url, { timeout }), limit);
      if (headlines) return headlines;
    } catch {
      // Unreachable or malformed: fall through to the next feed.
    }
  }
  return null;
}
