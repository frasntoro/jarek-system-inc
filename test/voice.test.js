import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { VOICE_DIR, introGreeting, introRemark, speak, voiceClip, voiceEnabled } from "../src/voice.js";

test("titled lines follow how the user is addressed", () => {
  assert.equal(voiceClip("bye", { title: { kind: "sir" } }), "bye-sir");
  assert.equal(voiceClip("bye", { title: { kind: "madam" } }), "bye-madam");
  assert.equal(voiceClip("bye", { title: { kind: "name", value: "Ada" } }), "bye");
  assert.equal(voiceClip("focus-done", {}), "focus-done-sir");
  assert.equal(voiceClip("scan-disk", { title: { kind: "madam" } }), "scan-disk");
});

test("every line Jarek can say has a recording", () => {
  const lines = ["focus-done", "bye"].flatMap((line) =>
    ["sir", "madam", "name"].map((kind) => voiceClip(line, { title: { kind } })),
  );
  lines.push("scan-disk", "scan-battery", "scan-memory", "scan-cpu", "scan-offline");
  for (const line of lines) assert.ok(existsSync(join(VOICE_DIR, `${line}.wav`)), line);
});

test("the voice stays silent when it or the sound is switched off", () => {
  assert.equal(voiceEnabled({ config: {}, options: {} }), true);
  assert.equal(voiceEnabled({ config: { voice: false }, options: {} }), false);
  assert.equal(voiceEnabled({ config: {}, options: { sound: false } }), false);
  assert.equal(speak("bye", { config: { voice: false }, options: {} }), null);
});

const at = (hour) => new Date(2026, 8, 16, hour, 0);
const weather = (now, degree = "°C") => ({ degree, now: { code: 3, feelsLike: 18, ...now }, tomorrow: {} });

test("the intro opens with a welcome that follows the title", () => {
  assert.equal(voiceClip(introGreeting(), { title: { kind: "sir" } }), "intro-welcome-sir");
  assert.equal(voiceClip(introGreeting(), { title: { kind: "madam" } }), "intro-welcome-madam");
  assert.equal(voiceClip(introGreeting(), { title: { kind: "name", value: "Ada" } }), "intro-welcome");
});

test("the second line fits the hour", () => {
  assert.equal(introRemark(at(9), null), "intro-morning");
  assert.equal(introRemark(at(15), weather({})), "intro-afternoon");
  assert.equal(introRemark(at(21), weather({ code: 0 })), "intro-evening");
  assert.equal(introRemark(at(2), null), "intro-night");
});

test("weather worth mentioning takes the second line's place", () => {
  assert.equal(introRemark(at(9), weather({ code: 63 })), "intro-rain-now");
  assert.equal(introRemark(at(9), weather({ code: 73 })), "intro-snow-now");
  assert.equal(introRemark(at(9), weather({ feelsLike: 1 })), "intro-cold");
  assert.equal(introRemark(at(9), weather({ feelsLike: 30 }, "°F")), "intro-cold");
  assert.equal(introRemark(at(14), weather({ feelsLike: 34 })), "intro-hot");
});

test("every intro line has a recording, for every title", () => {
  const lines = ["sir", "madam", "name"].map((kind) => voiceClip(introGreeting(), { title: { kind } }));
  for (const remark of ["morning", "afternoon", "evening", "night", "rain-now", "snow-now", "cold", "hot"]) lines.push(`intro-${remark}`);
  for (const line of lines) assert.ok(existsSync(join(VOICE_DIR, `${line}.wav`)), line);
});
