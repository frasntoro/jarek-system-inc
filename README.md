# Jarek System Inc. 🤖

A futuristic AI Butler for your macOS Terminal. Jarek is an interactive CLI assistant integrated with **Ollama** to run Large Language Models (LLMs) locally on your machine.

![Jarek Preview](https://raw.githubusercontent.com/frasntoro/jarek-system-inc/main/assets/preview.png)

## 🚀 Evolution 1.3.0

Jarek has evolved from a simple aesthetic CLI to a fully functional **Local AI Agent**.

### Key Features:

- **Local AI Brain:** Uses Ollama to run models like Llama 3 or Phi-3 offline.
- **Smart Context:** Automatically sees your current directory files and context.
- **Real Execution:** Can create files, open apps, and navigate your system (with permission).
- **Setup Wizard:** Guided calibration for RAM, Storage, and Ollama installation.
- **Sci-Fi Experience:** Original startup music, ASCII art, and Matrix mode.
- **Strict English Persona:** Professional and concise butler tone.

## Installation

```bash
npm install -g jarek-system-inc
```

## Quick Start

Just type `jarek` in your terminal:

```bash
jarek
```

On your first run, Jarek will initiate a **Calibration Sequence** to:

1. Scan your hardware (RAM).
2. Check/Install Ollama AI Engine.
3. Download your preferred Intelligence (Model).
4. Authorize access to specific sectors (Desktop/Documents).

## Interaction

You can talk to Jarek in natural language:

- _"Create a folder named ProjectX on my Desktop"_
- _"What files are in this directory?"_
- _"Summarize the content of @README.md"_
- _"What's the weather in Milan today?"_ (Uses real-time `curl` data)

### Special Commands:

- `setup`: Re-run the calibration wizard.
- `authorize <path>`: Add a new folder to Jarek's sight.
- `forget <name>`: Remove a folder from Jarek's sight.
- `break`: Enter Matrix simulation mode (press any key to exit).
- `help`: See all available commands.
- `exit`: Terminate the session.

### Maintenance Flags:

- `jarek --setup`: Force reconfiguration.
- `jarek --uninstall`: Total cleanup (removes models, config, and app).

## Privacy & Requirements

- **100% Local:** Your data never leaves your Mac. Communication happens via `127.0.0.1`.
- **Storage:** Requires ~10-15GB for AI models.
- **RAM:** 8GB minimum, 16GB+ recommended.

## Author

Created with 💜 by **frasntoro**.
