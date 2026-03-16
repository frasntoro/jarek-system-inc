const chalk = require("chalk");
const figlet = require("figlet");
const gradient = require("gradient-string");
const { getRAM, checkOllamaStatus, askQuestion, saveConfig, loadConfig, removeOllamaModel, getDirectorySize, startOllamaSilently } = require("./utils");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");

async function runSetup() {
  console.log("\x1B[2J\x1B[0;0H");
  const logoData = figlet.textSync("JAREK  Inc.", { font: "Slant" });
  console.log("\n" + gradient.instagram.multiline(logoData));
  console.log(gradient.instagram("by frasntoro\n"));
  console.log(chalk.gray("Welcome, Sir. I need to calibrate my systems for your Mac.\n"));

  const oldConfig = loadConfig();
  const config = { setup_completed: false, model: oldConfig ? oldConfig.model : "llama3", ram_gb: getRAM(), authorized_dirs: oldConfig ? oldConfig.authorized_dirs : [], personality: "butler", ollama_ready: false };

  console.log(chalk.yellow("Step 1: Hardware Analysis"));
  console.log(chalk.white(`  [SCAN] RAM detected: ${config.ram_gb} GB`));
  if (config.ram_gb < 8) console.log(chalk.red("  [WARN] Performance might be limited."));

  console.log(chalk.yellow("\nStep 2: Storage Requirements"));
  console.log(chalk.gray("  Note: I will need approximately 10-15 GB."));
  if ((await askQuestion("Proceed? (Y/N): ")).toLowerCase() !== "y") process.exit(0);

  console.log(chalk.yellow("\nStep 3: AI Engine Check (Ollama)"));
  let ollamaRunning = await checkOllamaStatus();
  if (ollamaRunning) { console.log(chalk.green("  [OK] Ollama is running.")); config.ollama_ready = true; }
  else {
    console.log(chalk.red("  [!] Ollama not detected."));
    if ((await askQuestion("Install Ollama now? (Y/N): ")).toLowerCase() === "y") {
      try {
        execSync("curl -fsSL https://ollama.com/install.sh | sh", { stdio: "inherit" });
        process.stdout.write(chalk.gray("  Starting AI Engine silently... "));
        ollamaRunning = await startOllamaSilently();
        config.ollama_ready = ollamaRunning;
      } catch (e) { try { execSync("ollama --version", { stdio: "ignore" }); config.ollama_ready = true; } catch (e2) { config.ollama_ready = false; } }
    }
  }

  console.log(chalk.yellow("\nStep 4: Intelligence Selection"));
  let suggestedModel = config.ram_gb >= 16 ? "llama3" : "phi3";
  const modelChoice = await askQuestion(`Use suggested model (${suggestedModel}) or type 'other'? (Enter/other): `);
  const newModel = modelChoice.toLowerCase() === "other" ? await askQuestion("Enter Ollama model: ") : suggestedModel;
  if (oldConfig && oldConfig.model && oldConfig.model !== newModel && (await askQuestion(chalk.white(`Delete previous intelligence '${oldConfig.model}'? (Y/N): `))).toLowerCase() === "y") await removeOllamaModel(oldConfig.model);
  config.model = newModel;
  if (config.ollama_ready) try { execSync(`ollama pull ${config.model}`, { stdio: "inherit" }); } catch (e) {}

  console.log(chalk.yellow("\nStep 5: File System Access"));
  if (config.authorized_dirs.length === 0) {
    if ((await askQuestion("Authorize Desktop? (Y/N): ")).toLowerCase() === "y") config.authorized_dirs.push(`${os.homedir()}/Desktop`);
    if ((await askQuestion("Authorize Documents? (Y/N): ")).toLowerCase() === "y") config.authorized_dirs.push(`${os.homedir()}/Documents`);
  }

  config.setup_completed = true;
  saveConfig(config);

  const ollamaSize = getDirectorySize(path.join(os.homedir(), ".ollama"));
  const printRow = (label, value, valueColor = chalk.white) => {
    const row = "║  " + label.padEnd(15) + value.toString();
    console.log(chalk.cyan.bold(row.padEnd(59) + "║"));
  };

  console.log("\n" + chalk.cyan.bold("╔══════════════════════════════════════════════════════════╗"));
  console.log(chalk.cyan.bold("║") + chalk.white.bold("                SYSTEM DEPLOYMENT REPORT                  ") + chalk.cyan.bold("║"));
  console.log(chalk.cyan.bold("╠══════════════════════════════════════════════════════════╣"));
  printRow("STATUS:", "FULLY CALIBRATED", chalk.green.bold);
  printRow("ENGINE:", "Ollama (Silent Background Process)");
  printRow("INTELLIGENCE:", config.model);
  printRow("SPACE USED:", ollamaSize);
  printRow("AUTH SECTORS:", config.authorized_dirs.length + " Folders");
  console.log(chalk.cyan.bold("╚══════════════════════════════════════════════════════════╝"));
  return;
}

module.exports = { runSetup };
