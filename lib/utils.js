const { exec, execSync } = require("child_process");
const readline = require("readline");
const chalk = require("chalk");
const fs = require("fs");
const path = require("path");
const os = require("os");
const http = require("http");

const CONFIG_PATH = path.join(os.homedir(), ".jarekrc");

const playSound = (filePath) => {
  const isMac = process.platform === "darwin";
  const isWin = process.platform === "win32";
  if (isMac) exec(`afplay "${filePath}"`);
  else if (isWin) exec(`powershell -c (New-Object Media.SoundPlayer "${filePath}").PlaySync()`);
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
  "📂 Mapping file system structure...",
  "🛡️  Verifying security protocols...",
  "📊 Analyzing hardware performance...",
  "🌐 Establishing local bridge...",
  "🧪 Testing synaptic responses...",
  "💾 Loading configuration archives...",
  "🔍 Scanning authorized sectors...",
  "📡 Checking Ollama heartbeat...",
  "🤖 Finalizing Butler personality...",
];

const askQuestion = (query) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(chalk.cyan.bold(query), (answer) => {
      rl.close();
      resolve(answer);
    });
  });
};

const loadConfig = () => {
  if (fs.existsSync(CONFIG_PATH)) {
    try { return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")); } catch (e) { return null; }
  }
  return null;
};

const saveConfig = (config) => fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");

const deleteConfig = () => {
  if (fs.existsSync(CONFIG_PATH)) fs.unlinkSync(CONFIG_PATH);
};

const getRAM = () => Math.round(os.totalmem() / (1024 * 1024 * 1024));

const checkOllamaStatus = () => {
  return new Promise((resolve) => {
    const req = http.get("http://127.0.0.1:11434/api/tags", (res) => resolve(res.statusCode === 200));
    req.on("error", () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
};

const removeOllamaModel = (modelName) => {
  return new Promise((resolve) => {
    try { exec(`ollama rm ${modelName}`, (err) => resolve(!err)); } catch (e) { resolve(false); }
  });
};

const uninstallOllamaApp = () => {
  return new Promise((resolve) => {
    if (process.platform === "darwin") {
      try {
        try { execSync("pkill -f Ollama", { stdio: "ignore" }); } catch(e) {}
        if (fs.existsSync("/Applications/Ollama.app")) execSync("rm -rf /Applications/Ollama.app", { stdio: "ignore" });
        if (fs.existsSync("/usr/local/bin/ollama")) execSync("rm -f /usr/local/bin/ollama", { stdio: "ignore" });
        const ollamaDir = path.join(os.homedir(), ".ollama");
        if (fs.existsSync(ollamaDir)) execSync(`rm -rf "${ollamaDir}"`, { stdio: "ignore" });
        resolve(true);
      } catch (e) { resolve(false); }
    } else resolve(false);
  });
};

const getDirectorySize = (dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) return "0";
    const output = execSync(`du -sh "${dirPath}"`).toString();
    return output.split("\t")[0];
  } catch (e) { return "Unknown"; }
};

module.exports = {
  playSound,
  resources,
  askQuestion,
  loadConfig,
  saveConfig,
  deleteConfig,
  getRAM,
  checkOllamaStatus,
  removeOllamaModel,
  uninstallOllamaApp,
  getDirectorySize,
  CONFIG_PATH,
};
