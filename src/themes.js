/**
 * Colour themes. A theme is either the name of a built-in palette or a list
 * of two or more hex colours the user picked themselves:
 *
 *   "theme": "arc"
 *   "theme": ["#ff0080", "#7928ca"]
 */

export const DEFAULT_THEME = "instagram";

export const THEMES = {
  instagram: [
    [131, 58, 180],
    [253, 29, 29],
    [252, 176, 69],
  ],
  iron: [
    [140, 12, 24],
    [232, 36, 40],
    [255, 198, 64],
  ],
  arc: [
    [44, 92, 222],
    [0, 192, 255],
    [196, 250, 255],
  ],
  matrix: [
    [0, 110, 40],
    [0, 214, 80],
    [180, 255, 180],
  ],
  // The series' own logo: its red, from the dark edge of the letters to the
  // lit centre, cooling into the grey of the glow around them.
  stranger: [
    [150, 20, 24],
    [226, 42, 38],
    [226, 42, 38],
    [170, 168, 172],
  ],
  // The 1985 poster instead: the pink of the title, held as long as the title
  // holds it, its gold glow, and the neon green of the subtitle, which
  // arrives only at the end.
  stranger85: [
    [224, 55, 122],
    [224, 55, 122],
    [244, 199, 76],
    [244, 199, 76],
    [203, 250, 86],
  ],
  vice: [
    [94, 231, 223],
    [180, 144, 202],
  ],
  mono: [
    [110, 110, 122],
    [238, 238, 244],
  ],
};

export function parseHex(text) {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(text).trim());
  if (!match) return null;
  const hex = match[1].length === 3 ? [...match[1]].map((digit) => digit + digit).join("") : match[1];
  return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
}

/** The palette to draw with; anything unrecognised falls back to the default. */
export function themePalette(theme) {
  if (Array.isArray(theme)) {
    const colors = theme.map(parseHex).filter(Boolean);
    if (colors.length >= 2) return colors;
  } else if (typeof theme === "string" && THEMES[theme.toLowerCase()]) {
    return THEMES[theme.toLowerCase()];
  }
  return THEMES[DEFAULT_THEME];
}

/**
 * Reads what a user typed — a theme name, or hex colours separated by spaces
 * or commas — and returns a theme value, or null if it makes no sense.
 */
export function parseThemeInput(text) {
  // People naturally repeat the command inside the picker ("tema iron"): allow it.
  const typed = String(text ?? "")
    .trim()
    .replace(/^(theme|tema|colou?rs?|colori|colore)\s+/i, "");
  if (!typed) return null;
  if (THEMES[typed.toLowerCase()]) return typed.toLowerCase();
  const parts = typed.split(/[\s,]+/).filter(Boolean);
  if (parts.length >= 2 && parts.every((part) => parseHex(part))) {
    return parts.map((part) => `#${parseHex(part).map((channel) => channel.toString(16).padStart(2, "0")).join("")}`);
  }
  return null;
}

export function themeLabel(theme, strings) {
  if (Array.isArray(theme)) return `${strings.theme.custom} ${theme.join(" ")}`;
  return typeof theme === "string" && THEMES[theme.toLowerCase()] ? theme.toLowerCase() : DEFAULT_THEME;
}
