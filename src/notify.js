/**
 * Desktop notifications, best effort: useful when a focus session ends while
 * the terminal is buried under other windows. Failure is always silent.
 */

import { spawn } from "node:child_process";

export function notify(title, message) {
  try {
    let child = null;
    if (process.platform === "darwin") {
      // JSON string literals are also valid AppleScript string literals.
      const script = `display notification ${JSON.stringify(message)} with title ${JSON.stringify(title)}`;
      child = spawn("osascript", ["-e", script], { stdio: "ignore" });
    } else if (process.platform === "linux") {
      child = spawn("notify-send", [title, message], { stdio: "ignore" });
    }
    child?.on("error", () => {});
  } catch {
    // Notifications are a nicety, never a requirement.
  }
}
