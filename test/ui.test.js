import assert from "node:assert/strict";
import { test } from "node:test";

import { formatRemaining, parseMinutes } from "../src/commands/focus.js";
import { formatUptime } from "../src/system.js";
import { clip, timeAgo } from "../src/commands/weather.js";
import { center, colorLevel, gradientText, mix, sample, truncate, wrap } from "../src/ui.js";

test("truncate keeps short text and marks what it cuts", () => {
  assert.equal(truncate("abc", 5), "abc");
  assert.equal(truncate("abcdef", 4), "abc…");
  assert.equal(truncate("ciao mondo", 6), "ciao…");
  assert.equal(truncate("èèèè", 3), "èè…");
});

test("center pads status labels, extra space on the right", () => {
  assert.equal(center("OK", 4), " OK ");
  assert.equal(center("OFF", 4), "OFF ");
  assert.equal(center("WARN", 4), "WARN");
  assert.equal(center("TOOLONG", 4), "TOOLONG");
});

test("sample interpolates along a gradient and clamps the ends", () => {
  const stops = [
    [0, 0, 0],
    [255, 255, 255],
  ];
  assert.deepEqual(sample(stops, 0), [0, 0, 0]);
  assert.deepEqual(sample(stops, 0.5), [128, 128, 128]);
  assert.deepEqual(sample(stops, 1), [255, 255, 255]);
  assert.deepEqual(sample(stops, -1), [0, 0, 0]);
  assert.deepEqual(sample(stops, 2), [255, 255, 255]);
});

test("mix blends one colour towards another", () => {
  assert.deepEqual(mix([100, 0, 50], [200, 100, 50], 0.5), [150, 50, 50]);
});

test("without a colour terminal, gradients are plain text", { skip: colorLevel !== 0 && "colour is forced" }, () => {
  assert.equal(gradientText("jarek"), "jarek");
});

test("uptime is compact", () => {
  assert.equal(formatUptime(59), "0m");
  assert.equal(formatUptime(2 * 3600 + 5 * 60), "2h 5m");
  assert.equal(formatUptime(3 * 86400 + 4 * 3600), "3d 4h");
});

test("focus reads minutes the way people type them", () => {
  assert.equal(parseMinutes(undefined), 25);
  assert.equal(parseMinutes("50"), 50);
  assert.equal(parseMinutes("0,5"), 0.5);
  for (const invalid of ["0", "-3", "abc", "601"]) assert.equal(parseMinutes(invalid), null, invalid);
});

test("focus counts down in mm:ss, and h:mm:ss past the hour", () => {
  assert.equal(formatRemaining(0), "00:00");
  assert.equal(formatRemaining(1), "00:01");
  assert.equal(formatRemaining(61_000), "01:01");
  assert.equal(formatRemaining(3_605_000), "1:00:05");
});

test("wrap breaks between words and never exceeds the width", () => {
  const lines = wrap("Le università di medicina si svuotano perché nessuno vuole andare in Siberia", 24);
  assert.ok(lines.every((text) => [...text].length <= 24), lines.join(" | "));
  assert.equal(lines.join(" "), "Le università di medicina si svuotano perché nessuno vuole andare in Siberia");
  assert.deepEqual(wrap("", 10), []);
});

test("clip shortens long summaries at a word boundary", () => {
  assert.equal(clip("short", 10), "short");
  assert.equal(clip("one two three four five", 14), "one two three…");
});

test("timeAgo speaks the user's language", () => {
  const now = Date.parse("2026-09-17T12:00:00Z");
  assert.equal(timeAgo(now - 5 * 60_000, "it-IT", now), "5 minuti fa");
  assert.equal(timeAgo(now - 3 * 3_600_000, "en-US", now), "3 hours ago");
  assert.equal(timeAgo(now - 26 * 3_600_000, "it-IT", now), "ieri");
  assert.equal(timeAgo(null, "it-IT", now), null);
});
