/**
 * Headlines from an RSS feed, chosen by the language Jarek is speaking:
 * Italian gets European coverage, English gets the American edition.
 * The parsing is deliberately minimal and needs no XML dependency: title,
 * summary, source and publication time of each item.
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

function tagContent(item, tag) {
  return item.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`, "i"))?.[1] ?? null;
}

/**
 * Recurring round-ups ("Le notizie del giorno | 16 settembre 2026 - Serale")
 * are not stories: a title, a bar, then a date.
 */
const DIGEST = /\|\s*(\d{1,2}\s+\p{L}+\s+\d{4}|\p{L}+\s+\d{1,2},?\s+\d{4})/u;

/** Feeds that do not name a source per item are credited by their host. */
const FEED_NAMES = { "it.euronews.com": "Euronews", "feeds.npr.org": "NPR" };

/**
 * Every story in a feed: `{ title, summary, source, published }`. A summary is
 * kept only when it adds something — Google News fills that field with a list
 * of links that merely repeats the title.
 */
export function parseStories(xml, limit, { feedName = null } = {}) {
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  const stories = [];
  for (const item of items) {
    const raw = tagContent(item, "title");
    if (!raw) continue;
    const fullTitle = decode(raw);
    const title = stripPublisher(fullTitle);
    if (!title || DIGEST.test(title) || stories.some((story) => story.title === title)) continue;

    const description = tagContent(item, "description");
    // Descriptions are HTML escaped inside XML: unescape, drop the tags, unescape again.
    let summary = description ? decode(decode(description).replace(/<[^>]+>/g, " ")) : "";
    if (summary.length < 30 || summary.toLowerCase().includes(title.toLowerCase().slice(0, 40))) summary = null;

    const published = Date.parse(tagContent(item, "pubDate") ?? "");
    stories.push({
      title,
      summary,
      source: decode(tagContent(item, "source") ?? "") || feedName,
      published: Number.isFinite(published) ? published : null,
    });
    if (stories.length >= limit) break;
  }
  return stories.length ? stories : null;
}

export function parseHeadlines(xml, limit) {
  return parseStories(xml, limit)?.map((story) => story.title) ?? null;
}

async function firstFeedWith(parse, { feed, language, timeout }) {
  for (const url of feed ? [feed] : feedsFor(language)) {
    try {
      const result = parse(await fetchText(url, { timeout }), FEED_NAMES[new URL(url).host] ?? null);
      if (result) return result;
    } catch {
      // Unreachable or malformed: fall through to the next feed.
    }
  }
  return null;
}

export function getHeadlines({ feed, language = "en", limit = 3, timeout = 4000 } = {}) {
  return firstFeedWith((xml) => parseHeadlines(xml, limit), { feed, language, timeout });
}

export function getStories({ feed, language = "en", limit = 6, timeout = 4000 } = {}) {
  return firstFeedWith((xml, feedName) => parseStories(xml, limit, { feedName }), { feed, language, timeout });
}
