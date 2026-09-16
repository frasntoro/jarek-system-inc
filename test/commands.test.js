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
