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
    sectors: async () => { console.log(chalk.cyan("\nAuthorized Sectors:")); config.authorized_dirs.forEach(d => console.log(chalk.white(` - ${d.replace(os.homedir(), "~")}`))); console.log(""); return true; },
    authorize: async (newPath) => {
      if (!newPath) return console.log(chalk.yellow("Usage: authorize <full_path>")), true;
      const absolutePath = path.resolve(newPath.trim().replace("~", os.homedir()));
      if (fs.existsSync(absolutePath)) { if (!config.authorized_dirs.includes(absolutePath)) { config.authorized_dirs.push(absolutePath); saveConfig(config); console.log(chalk.green(`\n✅ Sector Authorized: ${absolutePath}.\n`)); } else console.log(chalk.yellow(`\nℹ️ Sector already authorized.\n`)); }
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
    help: () => { console.log(chalk.cyan("\nAvailable Commands:")); console.log(chalk.white(" - 'break'      : Matrix animation\n - 'setup'      : Reconfigure Jarek\n - 'sectors'    : List authorized folders\n - 'authorize'  : Add folder\n - 'forget'     : Remove folder\n - 'exit'/'quit': Close\n - '@path'      : Context search")); return true; }
  };

  while (running) {
    const cwd = process.cwd();
    const prompt = `🤖 Jarek [${chalk.cyan(cwd.replace(os.homedir(), "~"))}] ❯ `;
    const input = await askQuestion(prompt);
    const trimmedInput = input.trim();
    if (trimmedInput === "") continue;
    const cmdParts = trimmedInput.split(" ");
    if (staticCommands[cmdParts[0].toLowerCase()]) { running = await staticCommands[cmdParts[0].toLowerCase()](cmdParts.slice(1).join(" ")); continue; }

    let context = "";
    try { context = fs.readdirSync(cwd).slice(0, 30).join(", "); } catch (e) {}
    if (input.includes("@")) {
      const contextPart = input.split(" ").find(p => p.startsWith("@"));
      if (contextPart) {
        const target = contextPart.substring(1);
        const fullPath = config.authorized_dirs.find(d => d.toLowerCase().endsWith(target.toLowerCase())) || path.resolve(target);
        try { if (fs.existsSync(fullPath)) {
          if (fs.statSync(fullPath).isDirectory()) context += ` | @${target}: ${fs.readdirSync(fullPath).slice(0, 20).join(", ")}`;
          else context += ` | @${target} content: ${fs.readFileSync(fullPath, "utf8").substring(0, 2000)}`;
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
        // Filtriamo comandi reali escludendo i semplici percorsi
        const shellCmd = matches.find(s => ["ls", "cd ", "curl", "open", "mkdir", "touch", "rm", "mv", "cp", "echo", "cat", "grep"].some(v => s.startsWith(v))) || matches[0];
        
        if (!shellCmd.includes("rm -rf /") && shellCmd !== cwd && !shellCmd.startsWith("/")) {
          if (shellCmd.startsWith("cd ")) {
            let targetPath = shellCmd.substring(3).trim().replace("~", os.homedir());
            const sectorMatch = config.authorized_dirs.find(d => d.toLowerCase().endsWith(targetPath.toLowerCase()));
            if (sectorMatch) targetPath = sectorMatch;
            else targetPath = path.resolve(targetPath);
            try { process.chdir(targetPath); console.log(chalk.green(`\n✅ Moved to: ${targetPath}\n`)); } catch (e) { console.log(chalk.red(`\n❌ Error: Directory not found.\n`)); }
            continue;
          }
          const isSafe = ["ls", "curl", "open", "cat", "man", "pwd", "date", "whoami", "grep"].some(safe => shellCmd.startsWith(safe));
          let execute = isSafe;
          if (!isSafe) { const confirm = await askQuestion(chalk.yellow(`Sir, shall I execute: ${chalk.cyan(shellCmd)}? (Y/N): `)); if (confirm.toLowerCase() === "y") execute = true; }
          if (execute) {
            await new Promise(res => { exec(shellCmd, (err, stdout, stderr) => { if (err) console.log(chalk.red(`\n❌ Error: ${stderr || err.message}`)); else { if (stdout) console.log(chalk.white("\n" + stdout)); console.log(chalk.green(`\n✅ Done.`)); } res(); }); });
          }
        }
      }
    } catch (error) { process.stdout.write("\x1B[2K\r"); console.log(chalk.red(`\n"Apologies Sir: ${error}"\n`)); }
  }
}

module.exports = { startChat };
