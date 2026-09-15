/**
 * The boot timeline, in seconds from the moment the music starts.
 *
 * The cue times are not arbitrary: they sit on onsets detected in the waveform
 * of assets/jarek-startup.wav (roughly a 0.52s beat grid, ~115 BPM). The track
 * builds until about 14.5s and fades out from 15.5s, so the cues start sparse
 * and tighten towards the climax, the last system reports in on the final hit,
 * and the briefing opens over the tail of the fade instead of after silence.
 *
 * Cues carrying a `task` are backed by real work started at t=0: their status
 * reflects whether that work succeeded. Those also marked `network` are the
 * only ones that report OFF when Jarek is running with --no-net.
 */

export const AUDIO_FILE = "jarek-startup.wav";
export const AUDIO_DURATION = 17.775;

/** The logo lands on the first accent of the track. */
export const LOGO_AT = 0.32;

/** Opening line of the briefing, over the fade-out. */
export const BRIEFING_AT = 16.2;

export const TIMELINE = [
  { at: 1.48, key: "core" },
  { at: 2.28, key: "power" },
  { at: 3.42, key: "coffee" },
  { at: 4.46, key: "heuristics" },
  { at: 5.4, key: "sector" },
  { at: 6.68, key: "uplink", task: "location", network: true },
  { at: 8.0, key: "atmosphere", task: "weather", network: true },
  { at: 9.24, key: "news", task: "news", network: true },
  { at: 10.6, key: "chrome" },
  { at: 11.66, key: "diagnostics", task: "system" },
  { at: 12.72, key: "workshop" },
  { at: 14.3, key: "final" },
  { at: 15.34, key: "online", final: true },
];
