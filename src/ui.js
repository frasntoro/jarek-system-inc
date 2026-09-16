/**
 * Terminal rendering: colour with graceful degradation, gradients, the logo,
 * the progress bar and the cursor helpers the boot sequence needs.
 *
 * Everything here is hand-rolled on purpose. Jarek has no runtime dependencies,
 * so `npx jarek` downloads one package and starts immediately.
 */

const out = process.stdout;

/* ------------------------------------------------------------------ colour */

function detectColorLevel() {
  const env = process.env;
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== "") return 0;
  if (env.FORCE_COLOR !== undefined) {
    const level = Number.parseInt(env.FORCE_COLOR, 10);
    return Number.isNaN(level) ? 3 : Math.min(3, Math.max(0, level));
  }
  if (!out.isTTY) return 0;
  if (env.TERM === "dumb") return 0;
  const colorterm = (env.COLORTERM ?? "").toLowerCase();
  if (colorterm === "truecolor" || colorterm === "24bit") return 3;
  if (env.TERM_PROGRAM === "iTerm.app" || env.TERM_PROGRAM === "WezTerm" || env.TERM_PROGRAM === "ghostty") return 3;
  if (/-256(color)?$/i.test(env.TERM ?? "")) return 2;
  if (env.WT_SESSION) return 3; // Windows Terminal
  return 1;
}

export const colorLevel = detectColorLevel();

/** Maps an RGB triplet onto the xterm-256 palette (grey ramp + 6×6×6 cube). */
function rgbTo256(r, g, b) {
  if (r === g && g === b) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return Math.round(((r - 8) / 247) * 24) + 232;
  }
  const scale = (v) => Math.round((v / 255) * 5);
  return 16 + 36 * scale(r) + 6 * scale(g) + scale(b);
}

/** Nearest of the eight basic ANSI colours, for terminals without 256 support. */
function rgbTo16(r, g, b) {
  const basics = [
    [0, 0, 0, 30],
    [205, 0, 0, 31],
    [0, 205, 0, 32],
    [205, 205, 0, 33],
    [0, 0, 238, 34],
    [205, 0, 205, 35],
    [0, 205, 205, 36],
    [229, 229, 229, 37],
  ];
  let best = basics[7];
  let bestDistance = Infinity;
  for (const candidate of basics) {
    const distance = (r - candidate[0]) ** 2 + (g - candidate[1]) ** 2 + (b - candidate[2]) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best[3];
}

export function paint(text, [r, g, b]) {
  if (colorLevel === 0) return text;
  if (colorLevel >= 3) return `\x1b[38;2;${r};${g};${b}m${text}\x1b[39m`;
  if (colorLevel === 2) return `\x1b[38;5;${rgbTo256(r, g, b)}m${text}\x1b[39m`;
  return `\x1b[${rgbTo16(r, g, b)}m${text}\x1b[39m`;
}

const style = (open, close) => (text) => (colorLevel === 0 ? text : `\x1b[${open}m${text}\x1b[${close}m`);

export const bold = style(1, 22);
export const dim = style(2, 22);

export const COLORS = {
  gray: [130, 130, 138],
  white: [235, 235, 240],
  green: [80, 220, 130],
  amber: [250, 185, 60],
  red: [250, 90, 90],
  violet: [131, 58, 180],
};

export const gray = (text) => paint(text, COLORS.gray);
export const white = (text) => paint(text, COLORS.white);
export const green = (text) => paint(text, COLORS.green);
export const amber = (text) => paint(text, COLORS.amber);
export const red = (text) => paint(text, COLORS.red);

/* --------------------------------------------------------------- gradients */

/**
 * The active palette. It starts as the house violet-to-amber sweep and is
 * replaced by the user's theme at startup (see src/themes.js); every gradient
 * reads it at call time, so a theme change applies everywhere at once.
 */
let palette = [
  [131, 58, 180],
  [253, 29, 29],
  [252, 176, 69],
];

export function setPalette(stops) {
  if (Array.isArray(stops) && stops.length >= 2) palette = stops;
}

export function getPalette() {
  return palette;
}

/** Blends a colour towards another: 0 keeps it, 1 reaches the target. */
export function mix(color, target, amount) {
  return color.map((channel, index) => Math.round(channel + (target[index] - channel) * amount));
}

export function sample(stops, position) {
  const clamped = Math.min(1, Math.max(0, position));
  const span = clamped * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(span));
  const ratio = span - index;
  const from = stops[index];
  const to = stops[index + 1];
  return [
    Math.round(from[0] + (to[0] - from[0]) * ratio),
    Math.round(from[1] + (to[1] - from[1]) * ratio),
    Math.round(from[2] + (to[2] - from[2]) * ratio),
  ];
}

export function gradientText(text, stops = palette) {
  if (colorLevel === 0 || text.length === 0) return text;
  const characters = [...text];
  const last = Math.max(1, characters.length - 1);
  return characters.map((character, index) => paint(character, sample(stops, index / last))).join("");
}

/**
 * Colours several lines by column, so the sweep stays vertically aligned and
 * the block reads as one object rather than a stack of stripes.
 */
export function gradientBlock(lines, stops = palette) {
  if (colorLevel === 0) return lines;
  const width = Math.max(1, ...lines.map((line) => [...line].length));
  return lines.map((line) =>
    [...line].map((character, index) => paint(character, sample(stops, index / (width - 1 || 1)))).join(""),
  );
}

/* -------------------------------------------------------------------- logo */

// Pre-rendered so figlet is not needed at runtime (FIGlet "Slant", by Glenn Chappell).
const LOGO_WIDE = [
  "       _____    ____  ________ __",
  "      / /   |  / __ \\/ ____/ //_/",
  " __  / / /| | / /_/ / __/ / ,<   ",
  "/ /_/ / ___ |/ _, _/ /___/ /| |  ",
  "\\____/_/  |_/_/ |_/_____/_/ |_|  ",
];

const LOGO_NARROW = [
  "     _____   ___  ______ __",
  " __ / / _ | / _ \\/ __/ //_/",
  "/ // / __ |/ , _/ _// ,<   ",
  "\\___/_/ |_/_/|_/___/_/|_|  ",
];

export function logoLines(width = terminalWidth()) {
  if (width < 30) return ["J A R E K"];
  if (width < 38) return LOGO_NARROW;
  return LOGO_WIDE;
}

/* ------------------------------------------------------------ terminal I/O */

export const isInteractive = Boolean(out.isTTY);

export function terminalWidth() {
  // A pty without a negotiated size reports 0, which is not nullish.
  const columns = out.columns;
  return Number.isInteger(columns) && columns > 0 ? columns : 80;
}

export function write(text) {
  out.write(text);
}

export function line(text = "") {
  out.write(`${text}\n`);
}

export function hideCursor() {
  if (isInteractive) out.write("\x1b[?25l");
}

export function showCursor() {
  if (isInteractive) out.write("\x1b[?25h");
}

/** Clears the current line and parks the cursor at its start. */
export function clearLine() {
  if (isInteractive) out.write("\r\x1b[2K");
}

export function moveUp(rows) {
  if (isInteractive && rows > 0) out.write(`\x1b[${rows}A`);
}

export function moveDown(rows) {
  if (isInteractive && rows > 0) out.write(`\x1b[${rows}B`);
}

export function progressBar(fraction, width = 34) {
  const clamped = Math.min(1, Math.max(0, fraction));
  const filled = Math.round(clamped * width);
  const bar = gradientBlock(["█".repeat(filled)])[0] + gray("░".repeat(width - filled));
  return `${bar} ${white(`${String(Math.round(clamped * 100)).padStart(3)}%`)}`;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Cuts text to the available width, with an ellipsis when something was lost. */
export function truncate(text, width) {
  const characters = [...text];
  if (characters.length <= width) return text;
  return `${characters.slice(0, Math.max(1, width - 1)).join("").trimEnd()}…`;
}

/** Splits text into lines of at most `width` characters, breaking between words. */
export function wrap(text, width) {
  const lines = [];
  let current = "";
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    if (!current) current = word;
    else if ([...current].length + 1 + [...word].length <= width) current += ` ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Pads text to `width`, keeping it centred — used for the status tags. */
export function center(text, width) {
  const padding = Math.max(0, width - [...text].length);
  const left = Math.floor(padding / 2);
  return " ".repeat(left) + text + " ".repeat(padding - left);
}
