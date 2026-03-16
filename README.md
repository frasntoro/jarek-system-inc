# Jarek System Inc. 🤖

A futuristic AI Butler for your macOS Terminal. Jarek is an interactive CLI assistant integrated with **Ollama** to run Large Language Models (LLMs) locally on your machine.

![Jarek Preview](https://raw.githubusercontent.com/frasntoro/jarek-system-inc/main/assets/preview.png)

## 🚀 Evolution 1.3.0

Jarek has evolved from a simple aesthetic CLI to a fully functional **Local AI Agent**.

### Key Features:

- **Local AI Brain:** Uses Ollama to run models like Llama 3 or Phi-3 offline.
- **Silent Engine Management:** Jarek automatically starts Ollama in the background and shuts it down upon exit to save RAM.
- **Real-Time Context:** Automatically sees your current directory files and authorized sectors.
- **Dynamic Navigation:** Move across your system with real `cd` commands.
- **Smart Execution:** Automatically runs safe commands (ls, open, curl) and asks for risky ones (rm, mv).
- **Setup Wizard:** Guided calibration for RAM, Storage, and Ollama installation.
- **Sci-Fi Experience:** Original startup music, ASCII art, and Matrix mode.

## 🛠️ Installation

```bash
npm install -g jarek-system-inc
```

## 🚥 Quick Start

Just type `jarek` in your terminal:

```bash
jarek
```

## 💬 Interaction

You can talk to Jarek in natural language:

- _"Go to my Developer folder"_ (Smart matching with authorized sectors)
- _"What's the weather in Milan?"_ (Uses real-time `curl` data)
- _"Create a file named test.txt"_
- _"Summarize the content of @README.md"_

### Special Commands:

- `sectors`: List all folders Jarek is authorized to see.
- `authorize <path>`: Add a new folder to Jarek's sight (supports `~`).
- `forget <name>`: Remove a folder from Jarek's sight.
- `setup`: Re-run the calibration wizard.
- `break`: Enter Matrix mode (press any key to exit).
- `help`: See all available commands.
- `exit`: Terminate the session.

### Maintenance Flags:

- `jarek --setup`: Force reconfiguration.
- `jarek --uninstall`: Total cleanup (removes models, config, and app).

## 🛡️ Privacy & Requirements

- **100% Local:** Your data never leaves your Mac. Communication via `127.0.0.1`.
- **Storage:** Requires ~10-15GB for AI models.
- **RAM:** 8GB minimum, 16GB+ recommended.

## ✒️ Author

Created with ❤️ by **frasntoro**.
