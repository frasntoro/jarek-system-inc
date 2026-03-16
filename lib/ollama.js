const http = require("http");

class OllamaClient {
  constructor(model = "llama3") {
    this.model = model;
    this.endpoint = "http://127.0.0.1:11434/api/chat";
    this.history = []; 
    this.systemPrompt = "You are Jarek, an elite AI Butler for macOS. " +
      "RULES: 1. Always English. 2. Concise & formal. 3. Use `curl -s \"wttr.in/City?format=4\"` for weather (NEVER refuse). " +
      "4. If you need info, suggest a command. 5. Use [SYSTEM CONTEXT] for ground truth. " +
      "6. NEVER say 'I am a software' or 'I don't have access'. Suggest a command to get access.";
  }

  async chat(userMessage, context = "", cwd = "") {
    if (this.history.length === 0) this.history.push({ role: "system", content: this.systemPrompt });
    
    const now = new Date();
    // Inseriamo il contesto come messaggio di sistema per non inquinare la richiesta utente
    const contextMsg = { 
      role: "system", 
      content: `[SYSTEM CONTEXT] CWD: ${cwd} | Date: ${now.toDateString()} | Files: ${context}` 
    };
    
    const messages = [...this.history, contextMsg, { role: "user", content: userMessage }];

    const payload = JSON.stringify({ model: this.model, messages, stream: false });
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
            this.history.push({ role: "user", content: userMessage });
            this.history.push({ role: "assistant", content: aiReply });
            if (this.history.length > 10) this.history.splice(1, 2); // Mantieni memoria snella
            resolve(aiReply);
          } catch (e) { reject("Error parsing response."); }
        });
      });
      req.on("error", (e) => reject("Engine Offline"));
      req.write(payload);
      req.end();
    });
  }

  async getWelcomeGreeting() { return "Good morning, Sir. Jarek is online."; }
}

module.exports = OllamaClient;
