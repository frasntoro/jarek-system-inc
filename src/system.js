/**
 * Local diagnostics. Everything here comes from `node:os`, so it works the same
 * on macOS, Linux and Windows and costs nothing.
 */

import os from "node:os";

const GIB = 1024 ** 3;

export function getSystemInfo() {
  return {
    platform: os.platform(),
    release: os.release(),
    hostname: os.hostname(),
    uptimeSeconds: Math.floor(os.uptime()),
    memoryFreeGb: Math.round(os.freemem() / GIB),
    memoryTotalGb: Math.round(os.totalmem() / GIB),
    cores: os.cpus()?.length ?? 0,
  };
}

/** "3d 4h" / "4h 12m" / "12m" — compact enough for one briefing line. */
export function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
