#!/usr/bin/env node

const figlet = require("figlet");
const chalk = require("chalk");
const gradient = require("gradient-string");
const path = require("path");
const { playSound, resources } = require("../lib/utils");
const { startChat } = require("../lib/commands");
const pkg = require("../package.json");


if (process.argv.includes("--version") || process.argv.includes("-v")) {
  console.log(chalk.cyan.bold(`Jarek System Inc. v${pkg.version}`));
  process.exit(0);
}

const audioPath = path.join(__dirname, "../assets/jarek-startup.wav");
const systemSound =
  process.platform === "darwin"
    ? "/System/Library/Sounds/Glass.aiff"
    : "C:\\Windows\\Media\\notify.wav";

playSound(audioPath);

setTimeout(() => {
  figlet("JAREK  Inc.", { font: "Slant" }, function (err, data) {
    if (err) return console.log("Ooops...", err);

    console.log("\n" + gradient.instagram.multiline(data));
    console.log(gradient.instagram("by frasntoro\n"));

    const chars = ["", "", "", ""];
    let i = 0;
    console.log(
      chalk.gray("System detected: ") + gradient.vice(process.platform) + "\n",
    );
    console.log("");

    const interval = setInterval(async () => {
      process.stdout.write("\x1B[1A");
      process.stdout.write(
        gradient.retro(`\rScanning ${chars[i % chars.length]}  \n`),
      );

      if (i < resources.length) {
        console.log(chalk.white(`  [LOADED] `) + chalk.gray(resources[i]));
      }
      i++;

      if (i === 20 || i > resources.length + 5) {
        clearInterval(interval);
        playSound(systemSound);
        console.log(chalk.green.bold("\n✅ System ready \nJarek is Online!\n"));

        startChat();
      }
    }, 1000);
  });
}, 800);
