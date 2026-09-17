/**
 * `scan` — system diagnostics, staged like the boot sequence. Every probe
 * starts at once; rows are revealed in order as their data lands, and the
 * bars fill up rather than appearing. A one-line verdict closes the scan.
 */

import { execFile } from "node:child_process";
import { readdirSync, readFileSync, statfsSync } from "node:fs";
import os from "node:os";
import { join, parse } from "node:path";

import { formatUptime } from "../system.js";
import { speak } from "../voice.js";
import {
  COLORS,
  amber,
  clearLine,
  gradientText,
  gray,
  isInteractive,
  line,
  paint,
  sleep,
  terminalWidth,
  truncate,
  white,
  write,
} from "../ui.js";

const GIB = 1024 ** 3;
const TONE_COLOR = { ok: COLORS.green, warn: COLORS.amber, bad: COLORS.red };

function run(command, args, timeout = 3000) {
  return new Promise((resolve) => {
    execFile(command, args, { timeout, windowsHide: true }, (error, stdout) => resolve(error ? null : String(stdout)));
  });
}

/* ------------------------------------------------------------------ probes */

async function measureCpu() {
  const before = os.cpus();
  await sleep(500);
  const after = os.cpus();
  let idle = 0;
  let total = 0;
  after.forEach((cpu, index) => {
    const previous = before[index]?.times;
    if (!previous) return;
    for (const key of Object.keys(cpu.times)) {
      const delta = cpu.times[key] - previous[key];
      total += delta;
      if (key === "idle") idle += delta;
    }
  });
  const model = (after[0]?.model ?? "")
    .replace(/\((R|TM)\)|CPU|@.*$/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return { percent: total > 0 ? Math.round((1 - idle / total) * 100) : 0, cores: after.length, model };
}

async function measureMemory() {
  const total = os.totalmem();
  let usedRatio = 1 - os.freemem() / total;
  if (process.platform === "darwin") {
    // macOS fills free memory with cache on purpose, so "free" means little.
    // Activity Monitor's "Memory Used" is app memory + wired + compressed.
    const stats = await run("vm_stat", []);
    const pageSize = Number(/page size of (\d+) bytes/.exec(stats ?? "")?.[1]);
    const pages = (name) => Number(new RegExp(`${name}:\\s+(\\d+)`).exec(stats ?? "")?.[1] ?? Number.NaN);
    const used =
      (pages("Anonymous pages") - pages("Pages purgeable") + pages("Pages wired down") + pages("Pages occupied by compressor")) *
      pageSize;
    if (Number.isFinite(used) && used > 0 && used < total) usedRatio = used / total;
  } else if (process.platform === "linux") {
    try {
      const available = /MemAvailable:\s+(\d+)/.exec(readFileSync("/proc/meminfo", "utf8"))?.[1];
      if (available) usedRatio = 1 - (Number(available) * 1024) / total;
    } catch {
      // Keep the Node estimate.
    }
  }
  return {
    percent: Math.round(usedRatio * 100),
    usedGb: Math.round((usedRatio * total) / GIB),
    totalGb: Math.round(total / GIB),
  };
}

async function measureDisk() {
  // The home folder sits on the volume people actually fill up; the root of
  // the current drive is the fallback when home is missing or unreadable.
  for (const path of [os.homedir(), parse(process.cwd()).root]) {
    try {
      const stats = statfsSync(path);
      const total = stats.blocks * stats.bsize;
      const free = stats.bavail * stats.bsize;
      return { percent: total ? Math.round((1 - free / total) * 100) : 0, freeGb: Math.round(free / GIB) };
    } catch {
      // Try the next location.
    }
  }
  return null;
}

async function measureBattery() {
  if (process.platform === "darwin") {
    const output = await run("pmset", ["-g", "batt"]);
    const match = output && /(\d+)%;\s*([^;]+);/.exec(output);
    if (!match) return null;
    const state = match[2].trim().toLowerCase();
    return {
      percent: Number(match[1]),
      state: state.startsWith("discharging")
        ? "discharging"
        : state.startsWith("charging") || state.startsWith("finishing")
          ? "charging"
          : state.startsWith("charged")
            ? "charged"
            : "plugged",
    };
  }

  if (process.platform === "linux") {
    try {
      const base = "/sys/class/power_supply";
      for (const name of readdirSync(base)) {
        const dir = join(base, name);
        if (readFileSync(join(dir, "type"), "utf8").trim() !== "Battery") continue;
        const status = readFileSync(join(dir, "status"), "utf8").trim().toLowerCase();
        return {
          percent: Number(readFileSync(join(dir, "capacity"), "utf8").trim()),
          state:
            status === "discharging"
              ? "discharging"
              : status === "charging"
                ? "charging"
                : status === "full"
                  ? "charged"
                  : "plugged",
        };
      }
    } catch {
      // No readable battery.
    }
    return null;
  }

  if (process.platform === "win32") {
    const output = await run(
      "powershell",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        '$b = Get-CimInstance Win32_Battery | Select-Object -First 1; if ($b) { "$($b.EstimatedChargeRemaining) $($b.BatteryStatus)" }',
      ],
      5000,
    );
    const match = output && /(\d+)\s+(\d+)/.exec(output);
    if (!match) return null;
    const status = Number(match[2]);
    return {
      percent: Number(match[1]),
      state: status === 1 ? "discharging" : status === 3 ? "charged" : status >= 6 && status <= 9 ? "charging" : "plugged",
    };
  }

  return null;
}

async function measureNetwork() {
  for (const url of ["https://www.gstatic.com/generate_204", "https://1.1.1.1/cdn-cgi/trace"]) {
    const started = Date.now();
    try {
      await fetch(url, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(3000) });
      return { online: true, ms: Date.now() - started };
    } catch {
      // Try the next endpoint.
    }
  }
  return { online: false };
}

/* --------------------------------------------------------------- rendering */

function tone(percent, { inverse = false } = {}) {
  if (inverse) return percent <= 15 ? "bad" : percent <= 30 ? "warn" : "ok";
  return percent >= 90 ? "bad" : percent >= 75 ? "warn" : "ok";
}

function meter(percent, width, toneName) {
  const filled = Math.round((Math.min(100, Math.max(0, percent)) / 100) * width);
  return paint("█".repeat(filled), TONE_COLOR[toneName]) + gray("░".repeat(width - filled));
}

export async function scan(args, ctx) {
  const s = ctx.strings.scan;
  const labelWidth = Math.max(...Object.values(s.labels).map((label) => label.length)) + 2;
  const barWidth = Math.max(10, Math.min(24, terminalWidth() - labelWidth - 32));
  const detailRoom = Math.max(12, terminalWidth() - labelWidth - barWidth - 14);

  const safe = (promise) => promise.catch(() => null);
  const probes = {
    cpu: safe(measureCpu()),
    memory: safe(measureMemory()),
    disk: safe(measureDisk()),
    battery: safe(measureBattery()),
    network: safe(measureNetwork()),
  };

  line();
  line(gradientText(`  ${s.title}`));
  line();

  const reveal = async (label, probe, describe) => {
    const head = `  ${white(label.padEnd(labelWidth))}`;
    if (isInteractive) write(`${head}${gray("··")}`);
    const value = await probe;
    const { percent, toneName = "ok", detail, detailTone } = describe(value);

    if (isInteractive && percent !== undefined) {
      for (let step = 1; step <= 8; step += 1) {
        clearLine();
        write(`${head}${meter((percent * step) / 8, barWidth, toneName)}`);
        await sleep(35);
      }
    }
    if (isInteractive) clearLine();

    const gauge =
      percent === undefined
        ? ""
        : `${meter(percent, barWidth, toneName)} ${paint(`${String(percent).padStart(3)}%`, TONE_COLOR[toneName])}  `;
    const text = truncate(detail, detailRoom);
    line(`${head}${gauge}${detailTone ? paint(text, TONE_COLOR[detailTone]) : gray(text)}`);
    return value;
  };

  const cpu = await reveal(s.labels.cpu, probes.cpu, (v) =>
    v ? { percent: v.percent, toneName: tone(v.percent), detail: s.cpu(v.cores, v.model) } : { detail: s.unavailable },
  );
  const memory = await reveal(s.labels.memory, probes.memory, (v) =>
    v
      ? { percent: v.percent, toneName: tone(v.percent), detail: s.memory(v.usedGb, v.totalGb) }
      : { detail: s.unavailable },
  );
  const disk = await reveal(s.labels.disk, probes.disk, (v) =>
    v ? { percent: v.percent, toneName: tone(v.percent), detail: s.disk(v.freeGb) } : { detail: s.unavailable },
  );
  const battery = await reveal(s.labels.battery, probes.battery, (v) =>
    v
      ? {
          percent: v.percent,
          toneName: v.state === "discharging" ? tone(v.percent, { inverse: true }) : "ok",
          detail: s[v.state],
        }
      : { detail: s.noBattery },
  );
  const network = await reveal(s.labels.network, probes.network, (v) =>
    v?.online ? { detail: s.online(v.ms), detailTone: "ok" } : { detail: s.offline, detailTone: "bad" },
  );
  await reveal(s.labels.uptime, Promise.resolve(os.uptime()), (v) => ({ detail: formatUptime(Math.floor(v)) }));

  // Worst problems first; two at most, so the verdict stays a verdict.
  const issues = [];
  if (disk && disk.percent >= 90) issues.push({ text: s.verdict.disk(disk.percent), voice: "scan-disk" });
  if (battery && battery.state === "discharging" && battery.percent <= 15) {
    issues.push({ text: s.verdict.battery(battery.percent), voice: "scan-battery" });
  }
  if (memory && memory.percent >= 90) issues.push({ text: s.verdict.memory(memory.percent), voice: "scan-memory" });
  if (cpu && cpu.percent >= 90) issues.push({ text: s.verdict.cpu(cpu.percent), voice: "scan-cpu" });
  if (network && !network.online) issues.push({ text: s.verdict.offline, voice: "scan-offline" });

  line();
  if (issues.length) {
    for (const issue of issues.slice(0, 2)) line(amber(`  ${issue.text}`));
    // Jarek only speaks up when something is wrong, and only about the worst of it.
    speak(issues[0].voice, ctx);
  } else {
    line(gradientText(`  ${s.verdict.allGood}`));
  }
  line();
}
