import assert from "node:assert/strict";
import { test } from "node:test";

import { feedsFor, parseHeadlines, parseStories } from "../src/sources/news.js";

const rss = (titles) =>
  `<?xml version="1.0"?><rss><channel><title>The feed itself</title>${titles
    .map((title) => `<item><title>${title}</title><link>https://example.com</link></item>`)
    .join("")}</channel></rss>`;

test("reads item titles, never the channel title", () => {
  assert.deepEqual(parseHeadlines(rss(["One", "Two"]), 3), ["One", "Two"]);
});

test("respects the limit and skips duplicates", () => {
  assert.deepEqual(parseHeadlines(rss(["A", "A", "B", "C", "D"]), 3), ["A", "B", "C"]);
});

test("decodes entities and CDATA sections", () => {
  const titles = ["<![CDATA[Markets close higher]]>", "L&#39;Italia &quot;vince&quot; &amp; festeggia", "Caf&#xE9;"];
  assert.deepEqual(parseHeadlines(rss(titles), 3), ["Markets close higher", 'L\'Italia "vince" & festeggia', "Café"]);
});

test("drops the publisher Google News appends, but not real hyphens", () => {
  assert.deepEqual(parseHeadlines(rss(["Big news today - Reuters", "Covid-19 cases fall"]), 2), [
    "Big news today",
    "Covid-19 cases fall",
  ]);
});

test("returns null when a page has no headlines", () => {
  assert.equal(parseHeadlines("<html><body>Nothing here</body></html>", 3), null);
});

test("Italian reads Euronews; any other language reads Google News US", () => {
  assert.match(feedsFor("it")[0], /euronews/);
  assert.match(feedsFor("en")[0], /news\.google\.com.*gl=US/);
  assert.deepEqual(feedsFor("de"), feedsFor("en"));
  assert.ok(feedsFor("it").length > 1, "a fallback feed exists");
});

test("stories keep a real summary, the source and the publication time", () => {
  const xml = `<rss><channel>
    <item>
      <title>In Russia le università di medicina si svuotano</title>
      <description><![CDATA[Nuove regole impongono agli studenti di medicina di lavorare dove richiesto.]]></description>
      <pubDate>Wed, 16 Sep 2026 19:29:07 +0200</pubDate>
    </item>
  </channel></rss>`;
  const [story] = parseStories(xml, 5, { feedName: "Euronews" });
  assert.equal(story.title, "In Russia le università di medicina si svuotano");
  assert.equal(story.summary, "Nuove regole impongono agli studenti di medicina di lavorare dove richiesto.");
  assert.equal(story.source, "Euronews");
  assert.equal(story.published, Date.parse("2026-09-16T17:29:07Z"));
});

test("recurring round-ups are skipped, real stories with a bar are kept", () => {
  const titles = [
    "Le notizie del giorno | 16 settembre 2026 - Serale",
    "The news of the day | September 16, 2026",
    "Kosovo | Thaçi condannato a 25 anni",
    "Borsa, giornata positiva",
  ];
  assert.deepEqual(parseHeadlines(rss(titles), 5), ["Kosovo | Thaçi condannato a 25 anni", "Borsa, giornata positiva"]);
});

test("a summary that only repeats the title as links is dropped", () => {
  const xml = `<rss><channel><item>
    <title>Massie kept the impeachment move a secret - Axios</title>
    <description>&lt;a href="https://news.google.com/x"&gt;Massie kept the impeachment move a secret&lt;/a&gt;&amp;nbsp;&amp;nbsp;&lt;font color="#6f6f6f"&gt;Axios&lt;/font&gt;</description>
    <source url="https://www.axios.com">Axios</source>
  </item></channel></rss>`;
  const [story] = parseStories(xml, 5);
  assert.equal(story.title, "Massie kept the impeachment move a secret");
  assert.equal(story.summary, null);
  assert.equal(story.source, "Axios");
  assert.equal(story.published, null);
});
