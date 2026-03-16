const http = require("http");

class OllamaClient {
  constructor(model = "llama3") {
    this.model = model;
    this.endpoint = "http://127.0.0.1:11434/api/chat";
    this.history = []; 
    this.systemPrompt = "You are Jarek, a highly efficient AI Butler for macOS. " +
      "LANGUAGE: Always respond in English. " +
      "ANTI-HALLUCINATION: NEVER invent file names. Use ONLY the files listed in the 'Current Directory Files' section. " +
      "If the user asks about a file NOT in that list, say you don't see it and suggest an `ls` command to refresh. " +
      "EXECUTION: Always provide commands in backticks. " +
      "PERSONALITY: Concise, formal butler.";
  }

  async chat(userMessage, context = "", cwd = "") {
    if (this.history.length === 0) this.history.push({ role: "system", content: this.systemPrompt });
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US");
    const systemInfo = `[SYSTEM CONTEXT]\nCWD: ${cwd}\nDATE: ${dateStr}\n${context}\n[END CONTEXT]`;
    this.history.push({ role: "user", content: `${systemInfo}\nUser Request: ${userMessage}` });
    const payload = JSON.stringify({ model: this.model, messages: this.history, stream: false });
    return new Promise((resolve, reject) => {
      const options = { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } };
      const req = http.request(this.endpoint, options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) return reject(`Ollama Error: ${res.statusCode}`);
          try {
            const response = JSON.parse(data);
            const aiReply = response.message.content;
            this.history.push({ role: "assistant", content: aiReply });
            resolve(aiReply);
          } catch (e) { reject("Error parsing AI response."); }
        });
      });
      req.on("error", (e) => reject(`Connection error: ${e.message || "Engine Offline"}`));
      req.write(payload);
      req.end();
    });
  }

  async getWelcomeGreeting() { return "Good morning, Sir. Jarek is online."; }
}

module.exports = OllamaClient;
