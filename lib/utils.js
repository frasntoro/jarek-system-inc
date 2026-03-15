const { exec } = require("child_process");
const readline = require("readline");
const chalk = require("chalk");
const fs = require("fs");
const path = require("path");
const os = require("os");

const playSound = (filePath) => {
  const isMac = process.platform === "darwin";
  const isWin = process.platform === "win32";

  if (isMac) {
    exec(`afplay "${filePath}"`);
  } else if (isWin) {
    exec(
      `powershell -c (New-Object Media.SoundPlayer "${filePath}").PlaySync()`,
    );
  }
};

const resources = [
  "🔗 Linking drive chains...",
  "⚙️  Lubricating gears...",
  "🔋 Charging power cells...",
  "📡 Syncing satellite uplink...",
  "🧠 Calibrating AI heuristics...",
  "🛠️  Tightening bolts...",
  "🔥 Igniting core engine...",
  "💎 Polishing chrome surfaces...",
  "🚀 Optimizing flux capacitors...",
];

const askQuestion = (query) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(chalk.cyan.bold(query), (answer) => {
      rl.close();
      resolve(answer);
    });
  });
};

const deployFile = (fileNameInAssets) => {
  return new Promise((resolve, reject) => {
    const sourcePath = path.resolve(
      __dirname,
      "..",
      "assets",
      fileNameInAssets,
    );
    const destPath = path.join(os.homedir(), "Desktop", fileNameInAssets);

    fs.copyFile(sourcePath, destPath, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(destPath);
      }
    });
  });
};

module.exports = { playSound, resources, askQuestion, deployFile };
