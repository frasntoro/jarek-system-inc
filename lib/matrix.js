const chalk = require("chalk");
const figlet = require("figlet");
const gradient = require("gradient-string");

function drawMatrixWithCenter() {
  const stdout = process.stdout;
  const [width, height] = stdout.getWindowSize();
  stdout.write("\x1B[?25l");

  const orange = chalk.hex("#FF8C00");
  const jarekLogo = gradient.instagram.multiline(
    figlet.textSync("JAREK", { font: "Slant" }),
  );

  const logoLines = jarekLogo.split("\n");
  const logoWidth = figlet
    .textSync("JAREK", { font: "Slant" })
    .split("\n")[0].length;
  const logoHeight = logoLines.length;
  const sX = Math.floor((width - logoWidth) / 2);
  const sY = Math.floor((height - logoHeight) / 2);

  const columns = Array(width).fill(0);
  const chars = "0123456789ABCDEF".split("");

  const interval = setInterval(() => {
    for (let i = 0; i < columns.length; i++) {
      stdout.cursorTo(i, columns[i]);
      stdout.write(orange(chars[Math.floor(Math.random() * chars.length)]));

      if (columns[i] >= height || Math.random() > 0.95) {
        columns[i] = 0;
      } else {
        columns[i]++;
      }
    }

    for (let l = 0; l < logoHeight; l++) {
      stdout.cursorTo(sX, sY + l);
      stdout.write(logoLines[l]);
    }
  }, 50);

  process.on("SIGINT", () => {
    clearInterval(interval);
    stdout.write("\x1B[?25h");
    stdout.write("\x1B[2J\x1B[0;0H");
    process.exit();
  });
}

module.exports = { startMatrix: drawMatrixWithCenter };
