const chalk = require("chalk");
const gradient = require("gradient-string");
const { startMatrix } = require("./matrix");
const { deployFile, askQuestion } = require("./utils");

/**
 * Gestisce la sessione interattiva di Jarek.
 * @async
 * @function startChat
 */
async function startChat() {
  let running = true;

  const commands = {
    break: async () => {
      process.stdout.write("\x1B[2J\x1B[0;0H");
      startMatrix();
      return false;
    },
    protocol: async () => {
      console.log(chalk.yellow("\nAccessing encrypted archives..."));
      try {
        await deployFile("top_secret.txt");
        console.log(
          chalk.green(
            "\n✅ Done. I've placed the classified files on your Desktop, Sir.\n",
          ),
        );
      } catch (error) {
        console.log(
          chalk.red("\n❌ Error: Could not access the asset folder."),
        );
      }
      return true;
    },
    exit: () => {
      console.log(chalk.green.bold("\nUnderstood. Goodbye, Sir!\n"));
      process.exit(0);
    },
    quit: () => commands.exit(),
    ciao: () => commands.exit(),
  };

  while (running) {
    const answer = await askQuestion(
      gradient.instagram("What are we doing today, Sir? \n"),
    );

    const cmd = answer.toLowerCase().trim();

    if (commands[cmd]) {
      running = await commands[cmd]();
    } else if (cmd !== "") {
      console.log(
        chalk.red(
          `\n"I'm afraid I can't do that, Sir. '${cmd}' is not a valid command.\n`,
        ),
      );
      const available = Object.keys(commands).filter(
        (c) => !["quit", "ciao"].includes(c),
      );
      console.log(
        chalk.gray(`Try: ${available.map((c) => `'${c}'`).join(", ")}\n`),
      );
    }
  }
}

module.exports = { startChat };
