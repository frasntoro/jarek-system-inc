#!/usr/bin/env node

const figlet = require("figlet");
const chalk = require("chalk");
const gradient = require("gradient-string");
const path = require("path");
const readline = require("readline");
const fs = require("fs");
const { playSound, resources, loadConfig, deleteConfig, checkOllamaStatus, askQuestion, removeOllamaModel, uninstallOllamaApp, startOllamaSilently, stopOllama } = require("../lib/utils");
const { startChat } = require("../lib/commands");
const { runSetup } = require("../lib/setup");
const pkg = require("../package.json");

function updateBootDisplay(current, total, message, status = " [OK] ") {
  const width = 40, progress = Math.round((current / total) * width), empty = width - progress;
  const bar = gradient.instagram("█".repeat(progress)) + chalk.gray("░".repeat(empty)), percent = Math.round((current / total) * 100);
  readline.cursorTo(process.stdout, 0);
  process.stdout.write(`  ${chalk.green(status)} ${chalk.gray(message.padEnd(45, " "))}\n`);
  readline.clearLine(process.stdout, 0);
  process.stdout.write(`  ${bar} ${chalk.white(percent + "%")}`);
  readline.moveCursor(process.stdout, 0, -1);
}

async function main() {
  process.on("SIGINT", () => { stopOllama(); process.exit(); });
  process.on("exit", () => stopOllama());

  if (process.argv.includes("--version") || process.argv.includes("-v")) { console.log(chalk.cyan.bold(`Jarek v${pkg.version}`)); process.exit(0); }
  if (process.argv.includes("--uninstall")) {
    const config = loadConfig(), confirm = await askQuestion(chalk.red.bold("Sir, uninstall and clear data? (Y/N): "));
    if (confirm.toLowerCase() === "y") { if (config && config.model) await removeOllamaModel(config.model); await uninstallOllamaApp(); deleteConfig(); console.log(chalk.green("\n✅ Done. Goodbye.")); }
    process.exit(0);
  }
  const config = loadConfig();
  if (!config || !config.setup_completed || process.argv.includes("--setup")) { await runSetup(); return; }
  const audioPath = path.join(__dirname, "../assets/jarek-startup.wav"), systemSound = process.platform === "darwin" ? "/System/Library/Sounds/Glass.aiff" : "C:\\Windows\\Media\\notify.wav";
  playSound(audioPath);
  setTimeout(() => {
    figlet("JAREK  Inc.", { font: "Slant" }, async function (err, data) {
      if (err) return;
      console.log("\n" + gradient.instagram.multiline(data));
      console.log(gradient.instagram("by frasntoro\n"));
      console.log(chalk.gray("System detected: ") + gradient.vice(process.platform) + "\n");
      process.stdout.write("\x1B[?25l\n\n");
      readline.moveCursor(process.stdout, 0, -2);
      let i = 0; const totalSteps = resources.length, intervalTime = Math.floor(16000 / totalSteps);
      const interval = setInterval(async () => {
        if (i < totalSteps) {
          let statusStr = " [OK] ", currentMsg = resources[i];
          if (currentMsg.includes("Ollama heartbeat")) {
            if (!(await checkOllamaStatus())) { statusStr = " [PWR] "; currentMsg = "Starting AI Engine silently..."; await startOllamaSilently(); }
          }
          if (currentMsg.includes("Loading configuration") && !fs.existsSync(path.join(require("os").homedir(), ".jarekrc"))) statusStr = " [ERR] ";
          if (currentMsg.includes("Scanning authorized sectors") && !config.authorized_dirs.every(d => fs.existsSync(d))) statusStr = " [WRN] ";
          updateBootDisplay(i + 1, totalSteps, currentMsg, statusStr);
          i++;
        } else {
          clearInterval(interval); readline.moveCursor(process.stdout, 0, 2); process.stdout.write("\n\x1B[?25h");
          if (!(await checkOllamaStatus())) { console.log(chalk.red("\n❌ AI Engine failed. Start Ollama manually.")); stopOllama(); process.exit(1); }
          playSound(systemSound); console.log(chalk.green.bold("✅ System ready\n")); startChat(config);
        }
      }, intervalTime);
    });
  }, 800);
}
main();
