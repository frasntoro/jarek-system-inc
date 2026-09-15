/**
 * Cross-platform sound playback with no dependencies: the first player that
 * actually starts wins. If none is available the boot sequence still runs on
 * its own clock, silently — the timeline never waits for audio.
 */

import { spawn } from "node:child_process";

function playersFor(platform, file) {
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

/**
 * Starts playback and returns a handle. `stop()` is safe to call at any point,
 * including when playback never started.
 */
export function playSound(file, { platform = process.platform } = {}) {
  const candidates = playersFor(platform, file);
  let child = null;
  let stopped = false;

  const tryNext = (index) => {
    if (stopped || index >= candidates.length) return;
    const [command, args] = candidates[index];
    let started = false;
    try {
      child = spawn(command, args, { stdio: "ignore" });
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
