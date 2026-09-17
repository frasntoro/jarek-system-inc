import assert from "node:assert/strict";
import { test } from "node:test";

import { COMMANDS, commandNames, findCommand, visibleCommands } from "../src/commands/index.js";
import { AUDIO_DURATION, BRIEFING_AT, LOGO_AT, TIMELINE } from "../src/cues.js";
import { getStrings } from "../src/i18n.js";

test("commands are found by name and by alias, whatever the case", () => {
  const expected = {
    break: "break",
    RELAX: "break",
    matrix: "break",
    meteo: "weather",
    notizie: "news",
    protocollo: "protocol",
    personalizza: "personalize",
    setup: "personalize",
    tema: "theme",
    esci: "bye",
  };
  for (const [typed, name] of Object.entries(expected)) assert.equal(findCommand(typed)?.name, name, typed);
  assert.equal(findCommand("fly"), null);
});

test("no word is claimed by two commands", () => {
  const words = COMMANDS.flatMap((command) => [command.name, ...command.aliases]);
  assert.equal(new Set(words).size, words.length);
});

test("every visible command is described in every language", () => {
  for (const lang of ["en", "it"]) {
    for (const command of visibleCommands()) {
      const entry = getStrings(lang).commands[command.name];
      assert.ok(entry?.usage && entry?.about, `${lang}: ${command.name}`);
    }
  }
});

test("the word shown in each menu is a word Jarek understands", () => {
  for (const lang of ["en", "it"]) {
    for (const command of visibleCommands()) {
      const word = getStrings(lang).commands[command.name].usage.split(" ")[0];
      assert.equal(findCommand(word)?.name, command.name, `${lang} menu shows "${word}"`);
    }
  }
});

test("Tab completion offers typeable words, sorted", () => {
  const names = commandNames();
  assert.ok(!names.includes("?"));
  assert.deepEqual(names, [...names].sort());
});

test("boot cues run in order, inside the track, with a text in every language", () => {
  let previous = LOGO_AT;
  for (const cue of TIMELINE) {
    assert.ok(cue.at > previous, `${cue.key} at ${cue.at}s comes after ${previous}s`);
    previous = cue.at;
    for (const lang of ["en", "it"]) assert.ok(getStrings(lang).boot[cue.key], `${lang}: ${cue.key}`);
  }
  assert.ok(BRIEFING_AT > previous && BRIEFING_AT < AUDIO_DURATION);
  assert.equal(TIMELINE.at(-1).final, true);
});

test("the shipped startup music is a real, full-length WAV", async () => {
  const { readFileSync } = await import("node:fs");
  const { MUSIC_FILE } = await import("../src/cues.js");
  const wav = readFileSync(new URL(`../assets/${MUSIC_FILE}`, import.meta.url));
  // Existing is not enough: an empty or truncated file must fail here.
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.toString("ascii", 8, 12), "WAVE");
  const channels = wav.readUInt16LE(22);
  const byteRate = wav.readUInt32LE(28);
  const dataAt = wav.indexOf("data", 12);
  const declared = wav.readUInt32LE(dataAt + 4);
  const present = wav.length - (dataAt + 8);
  // The header of a truncated file still claims the full length: count the bytes that are really there.
  assert.ok(present >= declared, `the file holds ${present} audio bytes but declares ${declared}`);
  const seconds = present / byteRate;
  assert.equal(channels, 2);
  assert.ok(Math.abs(seconds - AUDIO_DURATION) < 0.1, `music lasts ${seconds.toFixed(2)}s, the timeline expects ${AUDIO_DURATION}s`);
});
