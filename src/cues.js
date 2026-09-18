/**
 * The boot timeline, in seconds from the moment the music starts.
 *
 * The music is "Jarek intro" by Marco Sgaramella: 120 BPM, a sparse opening
 * before the full band comes in around 4 s, cut to 17.93 s with a two-second
 * fade. Every cue sits on an onset detected in the waveform, so the systems
 * report in on the drums, and the briefing opens over the fade.
 *
 * Cues carrying a `task` are backed by real work started at t=0: their status
 * reflects whether that work succeeded. Those also marked `network` are the
 * only ones that report OFF when Jarek is running with --no-net.
 */

/** The startup music shipped with Jarek, relative to assets/. */
export const MUSIC_FILE = "music/jarek-intro-marco-sgaramella.wav";

/** Length of the track the timeline was designed against. */
export const AUDIO_DURATION = 17.93;

/** When Jarek speaks during the intro, on the beat: the welcome, then a line that fits the hour or the weather. */
export const VOICE_AT = { greeting: 1.42, remark: 6.92 };

/** No music between these hours (the voice still speaks): nobody wants a rock intro at midnight. */
export const QUIET_HOURS = { from: 21, to: 7 };

/**
 * The logo lands on the first hit of the track: the music opens with 0.79 s of
 * silence, and afplay takes about 0.14 s to start producing sound.
 */
export const LOGO_AT = 0.93;

/** Opening line of the briefing, over the fade-out. */
export const BRIEFING_AT = 16.1;

export const TIMELINE = [
  { at: 1.49, key: "core" },
  { at: 2.21, key: "power" },
  { at: 3.5, key: "coffee" },
  { at: 4.4, key: "heuristics" },
  { at: 5.43, key: "sector" },
  { at: 6.69, key: "uplink", task: "location", network: true },
  { at: 7.98, key: "atmosphere", task: "weather", network: true },
  { at: 9.25, key: "news", task: "news", network: true },
  { at: 10.64, key: "chrome" },
  { at: 11.79, key: "diagnostics", task: "system" },
  { at: 12.82, key: "workshop" },
  { at: 14.35, key: "final" },
  { at: 15.4, key: "online", final: true },
];
