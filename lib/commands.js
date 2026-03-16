const chalk = require("chalk");
const gradient = require("gradient-string");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { exec } = require("child_process");
const { startMatrix } = require("./matrix");
const { askQuestion, saveConfig } = require("./utils");
const OllamaClient = require("./ollama");

async function startChat(config) {
  let running = true;
  const ollama = new OllamaClient(config.model);
  process.stdout.write(chalk.yellow("Jarek is waking up... \r"));
  const welcome = await ollama.getWelcomeGreeting();
  process.stdout.write("\x1B[2K\r");
  console.log(gradient.instagram(welcome + "\n"));

  const staticCommands = {
    break: async () => { await startMatrix(); process.stdout.write(chalk.green("\n✅ Systems restored. I am back, Sir.\n")); return true; },
    setup: async () => { console.log(chalk.yellow("\nSir, I'm initiating the reconfiguration sequence...")); const { runSetup } = require("./setup"); await runSetup(); return false; },
    authorize: async (newPath) => {
      if (!newPath) return console.log(chalk.yellow("Usage: authorize <full_path>")), true;
      const absolutePath = path.resolve(newPath.replace("~", os.homedir()));
      if (fs.existsSync(absolutePath)) { if (!config.authorized_dirs.includes(absolutePath)) { config.authorized_dirs.push(absolutePath); saveConfig(config); console.log(chalk.green(`\n✅ Authorized: ${absolutePath}.\n`)); } }
      else console.log(chalk.red(`\n❌ Path not found: ${absolutePath}\n`));
      return true;
    },
    forget: async (folderName) => {
      if (!folderName) return console.log(chalk.yellow("Usage: forget <folder_name>")), true;
      const initialLength = config.authorized_dirs.length;
      config.authorized_dirs = config.authorized_dirs.filter(d => !d.toLowerCase().includes(folderName.toLowerCase()));
      if (config.authorized_dirs.length < initialLength) { saveConfig(config); console.log(chalk.green(`\n✅ I have forgotten '${folderName}', Sir.\n`)); }
      else console.log(chalk.yellow(`\n❓ No authorized path with '${folderName}', Sir.\n`));
      return true;
    },
    exit: () => { console.log(chalk.green.bold("\nUnderstood. Goodbye, Sir!\n")); process.exit(0); },
    quit: () => staticCommands.exit(),
    help: () => {
      console.log(chalk.cyan("\nAvailable Commands:"));
      console.log(chalk.white(" - 'break'      : Matrix animation\n - 'setup'      : Reconfigure\n - 'authorize'  : Add folder\n - 'forget'     : Remove folder\n - 'exit'/'quit': Close\n - '@path'      : Use context"));
      return true;
    }
  };

  while (running) {
    const cwd = process.cwd();
    const prompt = `🤖 Jarek [${chalk.cyan(cwd.replace(os.homedir(), "~"))}] ❯ `;
    const input = await askQuestion(prompt);
    const trimmedInput = input.trim();
    const cmdParts = trimmedInput.split(" ");
    if (staticCommands[cmdParts[0].toLowerCase()]) { running = await staticCommands[cmdParts[0].toLowerCase()](cmdParts.slice(1).join(" ")); continue; }
    if (trimmedInput === "") continue;

    let context = "";
    try { context = `Current Directory Files:\n${fs.readdirSync(cwd).slice(0, 30).join("\n")}\n`; } catch (e) {}
    if (input.includes("@")) {
      const contextPart = input.split(" ").find(p => p.startsWith("@"));
      if (contextPart) {
        const target = contextPart.substring(1);
        const fullPath = config.authorized_dirs.find(d => d.toLowerCase().endsWith(target.toLowerCase())) || path.resolve(target);
        try { if (fs.existsSync(fullPath)) {
          if (fs.statSync(fullPath).isDirectory()) context += `\nTarget Context (@${target}):\n${fs.readdirSync(fullPath).slice(0, 20).join("\n")}`;
          else context += `\nTarget File Content (@${target}):\n${fs.readFileSync(fullPath, "utf8").substring(0, 3000)}`;
        }} catch (e) {}
      }
    }

    process.stdout.write(gradient.instagram("Jarek is thinking... \r"));
    try {
      const response = await ollama.chat(trimmedInput, context, cwd);
      process.stdout.write("\x1B[2K\r");
      console.log(gradient.instagram(response + "\n"));
      const cmdRegex = /`([^`]+)`/g;
      let matches = [], m;
      while ((m = cmdRegex.exec(response)) !== null) { if (m[1].trim().length > 2) matches.push(m[1].trim()); }
      if (matches.length > 0) {
        const shellCmd = matches.find(s => s.includes(" ") || s.includes("/") || s.includes("~") || s.includes(">") || s.includes("curl") || s.startsWith("cd")) || matches[0];
        if (!shellCmd.includes("rm -rf /") && shellCmd !== cwd) {
          if (shellCmd.startsWith("cd ")) { try { process.chdir(path.resolve(shellCmd.substring(3).trim().replace("~", os.homedir()))); console.log(chalk.green(`\n✅ Moved.`)); } catch (e) {} continue; }
          const isSafe = ["ls", "curl", "open", "cat", "man", "pwd", "date", "whoami", "grep"].some(safe => shellCmd.startsWith(safe));
          let execute = isSafe;
          if (!isSafe) { const confirm = await askQuestion(chalk.yellow(`Sir, shall I execute: ${chalk.cyan(shellCmd)}? (Y/N): `)); if (confirm.toLowerCase() === "y") execute = true; }
          if (execute) { exec(shellCmd, (err, stdout) => { if (err) console.log(chalk.red(`\n❌ Error.`)); else { if (stdout) console.log(chalk.white("\n" + stdout)); console.log(chalk.green(`\n✅ Done.`)); } }); }
        }
      }
    } catch (error) { process.stdout.write("\x1B[2K\r"); console.log(chalk.red(`\n"Apologies Sir: ${error}"\n`)); }
  }
}

module.exports = { startChat };
