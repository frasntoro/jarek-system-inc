/**
 * Cross-platform sound playback with no dependencies: the first player that
 * actually starts wins. If none is available the caller carries on silently —
 * the boot timeline never waits for audio.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

function musicPlayers(platform, file) {
  switch (platform) {
    case "darwin":
      return [["afplay", [file]]];
    case "win32":
      return [
        [
          "powershell",
          ["-NoProfile", "-NonInteractive", "-Command", `(New-Object Media.SoundPlayer '${file}').PlaySync()`],
        ],
      ];
    default:
      return [
        ["paplay", [file]],
        ["aplay", ["-q", file]],
        ["ffplay", ["-nodisp", "-autoexit", "-loglevel", "quiet", file]],
        ["mpv", ["--no-video", "--really-quiet", file]],
      ];
  }
}

/** A short system sound, for the end of a focus session. */
function chimePlayers(platform) {
  switch (platform) {
    case "darwin":
      return [["afplay", ["/System/Library/Sounds/Glass.aiff"]]];
    case "win32":
      return [
        [
          "powershell",
          [
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "[System.Media.SystemSounds]::Asterisk.Play(); Start-Sleep -Milliseconds 800",
          ],
        ],
      ];
    default: {
      const file = [
        "/usr/share/sounds/freedesktop/stereo/complete.oga",
        "/usr/share/sounds/freedesktop/stereo/bell.oga",
      ].find((candidate) => existsSync(candidate));
      if (!file) return [];
      return [
        ["paplay", [file]],
        ["ffplay", ["-nodisp", "-autoexit", "-loglevel", "quiet", file]],
      ];
    }
  }
}

/**
 * Starts the first working player and returns a handle whose `stop()` is safe
 * to call at any point, including when nothing ever played.
 */
function playFirst(candidates, { onUnavailable } = {}) {
  let child = null;
  let stopped = false;

  const tryNext = (index) => {
    if (stopped) return;
    if (index >= candidates.length) {
      onUnavailable?.();
      return;
    }
    const [command, args] = candidates[index];
    let started = false;
    try {
      child = spawn(command, args, { stdio: "ignore", windowsHide: true });
    } catch {
      tryNext(index + 1);
      return;
    }
    child.on("spawn", () => {
      started = true;
    });
    child.on("error", () => {
      child = null;
      if (!started) tryNext(index + 1);
    });
  };

  tryNext(0);

  return {
    stop() {
      stopped = true;
      if (!child) return;
      try {
        child.kill();
      } catch {
        // The player already exited.
      }
      child = null;
    },
  };
}

export function playSound(file, { platform = process.platform } = {}) {
  return playFirst(musicPlayers(platform, file));
}

export function playChime({ platform = process.platform } = {}) {
  return playFirst(chimePlayers(platform), {
    // No player at all: the terminal bell is better than silence.
    onUnavailable: () => {
      if (process.stdout.isTTY) process.stdout.write("\x07");
    },
  });
}

/**
 * Whether `date` falls in the quiet hours, a window that may cross midnight
 * (21 → 7). A user can move or disable it with "quietHours" in the config;
 * `false` turns it off.
 */
export function isQuietHour(date, hours) {
  if (hours === false) return false;
  const { from, to } = hours;
  const hour = date.getHours();
  return from <= to ? hour >= from && hour < to : hour >= from || hour < to;
}
