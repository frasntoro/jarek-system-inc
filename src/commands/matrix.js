/**
 * `break` — the screensaver: digital rain around the JAREK logo, in the
 * user's theme colours, on the terminal's alternate screen so whatever was
 * there comes back untouched. Any key leaves.
 *
 * Each column takes its colour from the theme gradient, left to right, like
 * the logo. Only changed cells are written each frame, and the rain never
 * draws inside the logo's frame, so the logo stays crisp without redraws.
 */

import { animationNames, findAnimation, registerAnimation } from "../animations.js";
import { getPalette, gradientBlock, gray, isInteractive, line, logoLines, mix, paint, sample, terminalWidth } from "../ui.js";

const GLYPHS = [..."ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789"];
const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];
const FRAME_MS = 50;

const glyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
const moveTo = (row, col) => `\x1b[${row + 1};${col + 1}H`;

/**
 * `break [name]` — the rain by default, or any animation a plugin registered.
 * An unknown name says so and lists what there is, rather than doing nothing.
 */
export function breakCommand(args, ctx) {
  const wanted = String(args?.[0] ?? "").trim();
  if (!wanted) return matrix(args, ctx);

  const animation = findAnimation(wanted);
  if (animation) return animation.run(args.slice(1), ctx);

  line(gray(`  ${ctx.strings.repl.noAnimation(wanted, animationNames().join(" · "))}`));
  return Promise.resolve();
}

export function matrix(args, ctx) {
  if (!isInteractive || !process.stdin.isTTY) {
    line(gray(`  ${ctx.strings.repl.needsTerminal}`));
    return Promise.resolve();
  }

  const out = process.stdout;
  const input = process.stdin;

  return new Promise((resolve) => {
    let width = 0;
    let height = 0;
    let drops = [];
    let tints = [];
    let box = null;

    // Speed stays at or below one row per frame, so no row is ever skipped
    // and every trail gets erased. On the first layout drops start anywhere
    // on screen, so the rain is already falling the moment it appears.
    const newDrop = (anywhere) => ({
      y: anywhere ? Math.random() * height * 1.2 - height * 0.2 : -Math.random() * height * 0.5,
      speed: 0.3 + Math.random() * 0.7,
      length: 6 + Math.floor(Math.random() * Math.max(6, height * 0.6)),
      last: null,
    });

    const insideBox = (row, col) =>
      row >= box.top && row <= box.bottom && col >= box.left && col <= box.right;

    const layout = () => {
      width = terminalWidth();
      height = out.rows > 0 ? out.rows : 24;

      const art = logoLines(width);
      const artWidth = Math.max(...art.map((text) => text.length));
      const top = Math.max(0, Math.floor((height - art.length) / 2));
      const left = Math.max(0, Math.floor((width - artWidth) / 2));
      box = { top: top - 1, bottom: top + art.length, left: left - 3, right: left + artWidth + 2 };

      const palette = getPalette();
      tints = Array.from({ length: width }, (_, col) => {
        const base = sample(palette, col / Math.max(1, width - 1));
        return { head: mix(base, WHITE, 0.65), body: base, fade: mix(base, BLACK, 0.55) };
      });
      drops = Array.from({ length: width }, () => newDrop(true));

      let frame = "\x1b[2J";
      gradientBlock(art).forEach((text, index) => {
        frame += moveTo(top + index, left) + text;
      });
      out.write(frame);
    };

    const tick = () => {
      let frame = "";
      // The last column is left alone: writing there can make some
      // terminals wrap and scroll.
      for (let col = 0; col < width - 1; col += 1) {
        const drop = drops[col];
        drop.y += drop.speed;
        const head = Math.floor(drop.y);
        if (head === drop.last) continue;
        drop.last = head;

        const put = (row, color, character) => {
          if (row < 0 || row >= height || insideBox(row, col)) return;
          frame += moveTo(row, col) + (color ? paint(character, color) : character);
        };
        const tint = tints[col];
        put(head, tint.head, glyph());
        put(head - 1, tint.body, glyph());
        put(head - Math.floor(drop.length * 0.6), tint.fade, glyph());
        put(head - drop.length, null, " ");

        if (head - drop.length > height) drops[col] = newDrop(false);
      }
      if (frame) out.write(frame);
    };

    let closed = false;
    const leave = () => {
      if (closed) return;
      closed = true;
      clearInterval(timer);
      out.off("resize", layout);
      input.off("data", leave);
      input.setRawMode(false);
      input.pause();
      out.write("\x1b[0m\x1b[?25h\x1b[?1049l");
      resolve();
    };

    out.write("\x1b[?1049h\x1b[?25l");
    layout();
    const timer = setInterval(tick, FRAME_MS);
    out.on("resize", layout);
    input.setRawMode(true);
    input.resume();
    input.on("data", leave);
  });
}

// The one that ships with Jarek, and the one `break` falls back to.
registerAnimation({ name: "matrix", about: "digital rain around the logo", run: matrix });
