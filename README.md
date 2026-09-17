# Jarek

[![tests](https://github.com/frasntoro/jarek-system-inc/actions/workflows/test.yml/badge.svg)](https://github.com/frasntoro/jarek-system-inc/actions/workflows/test.yml)

A JARVIS-style companion for your terminal.

Type `jarek`. The music kicks in, the logo lands on the first beat, Jarek
welcomes you back, and the systems come online one by one — in time with the
track. When the music fades, he tells you what you need to know: the time, the
weather where you are, the headlines of the hour. Then he stays on duty,
waiting for your orders.

![Jarek: boot sequence, briefing, scan, focus, break and bye](media/jarek.gif)

## Run it

No installation required:

```bash
npx jarek-system-inc
```

Or keep it around:

```bash
npm install -g jarek-system-inc
jarek
```

The first time, Jarek asks three quick questions — how you would like to be
addressed, which city to use for the weather, and whether you want his voice —
and remembers the answers. `personalize` changes any of them later.

Press any key during the boot sequence to skip ahead.

## Commands

At the `jarek ❯` prompt, or straight from your shell without the intro
(`jarek scan`, `jarek focus 50`):

| Command | What it does |
| --- | --- |
| `focus [min]` | A focus session with a live progress bar. Jarek tells you when time is up, with a desktop notification too. `q` stops it. |
| `scan` | System diagnostics: CPU, memory, disk, battery, network and uptime, with a verdict. Jarek speaks up only when something is wrong. |
| `break` | Screensaver: digital rain around the Jarek logo, in your colours. Any key returns you where you were. Also `relax` or `screensaver`. |
| `weather [city]` | Weather now and tomorrow, for your city or any other. |
| `news` | The headlines of the hour. |
| `protocol [name]` | Runs one of your custom sequences; `protocol new` builds one (see below). |
| `personalize` | One menu for everything: how Jarek addresses you, city, music, voice, colours, protocols. |
| `theme [name]` | Changes Jarek's colours (see below). |
| `bye` | The power-down sequence: Jarek says goodbye and sums up today's commits. |

`help` shows the list again. Arrow keys recall previous commands and Tab
completes them. Italian speakers can type `meteo`, `notizie`, `protocollo`,
`personalizza` and `tema`.

## Voice and music

Jarek speaks, in English, at a few chosen moments:

- **The boot sequence** — he welcomes you back, then adds a line that fits the
  hour: a cup of coffee in the morning, a short break in the afternoon, a good
  evening or a good night. If it is raining, snowing, freezing or very hot
  outside, he tells you that instead.
- **The end of a `focus` session**, so you hear it even away from the screen.
- **`scan`**, only when something is wrong, and only about the worst of it.
- **`bye`**, as the systems power down.

He addresses you as you asked — sir or ma'am, or without a title if you chose
a name, which cannot be pre-recorded. Turn the voice off in `personalize`;
`--no-sound` silences everything.

The startup music is **"Jarek" by Marco Sgaramella**. Between 9 pm and 7 am the
music stays off and only the voice remains, so a late start stays quiet. The
window can be moved, or switched off, in the configuration file:

```json
{ "quietHours": { "from": 22, "to": 8 } }
```

To start with a track of your own, point `startupSound` at a file on your
machine; it is never part of the package. The boot sequence is timed for about
18 seconds at 120 BPM.

```json
{ "startupSound": "~/Music/my-intro.wav" }
```

## Colours

Jarek draws the logo, the bars and the screensaver with a colour theme. The
default is `instagram`, the violet-to-amber sweep Jarek has always had.

```bash
theme                      # pick from the list, with a preview of each
theme arc                  # set a built-in theme
theme #ff0080 #7928ca      # or your own gradient: two or more hex colours
```

Built-in themes: `instagram`, `iron`, `arc`, `matrix`, `vice`, `mono`. The
same choice is item 4 of `personalize`.

## Protocols

A protocol is a list of actions you create once and run with one word —
opening the apps and sites you start every day with, bringing up a project,
starting a server.

**Create one with `protocol new`.** Jarek asks for a name, then one action at
a time, and shows a recap before saving:

```
jarek ❯ protocol new
  NEW PROTOCOL · run it with: protocol <name>
  Name? (e.g. work) › browser

  Action 1 · 1 app · 2 website · 3 folder or file · 4 command › 1
  App? (e.g. Chrome) › chrome
  ✓ Open Google Chrome

  Action 2 · 1 app · 2 website · 3 folder or file · 4 command (Enter = done) › 2
  Website? (e.g. youtube.com) › youtube.com
  ✓ Open youtube.com

  Action 3 · 1 app · 2 website · 3 folder or file · 4 command (Enter = done) ›

  browser: Open Google Chrome → Open youtube.com
  Save? (Y/n) ›
  ✓ Saved. To run it: protocol browser
  Try it now? (Y/n) ›
```

**Run it with `protocol browser`.** Each action reports `OK`, or `WARN` if it
could not be done.

- Apps are looked up among those installed, so a partial name is enough.
- Websites can be typed as you would in a browser: `youtube.com`, `localhost:3000`.
- Commands run through your own shell, so your aliases and functions work as
  they do in your terminal. Jarek asks whether a command should keep running in
  the background, like a server.

`protocol` lists your protocols with their actions. `protocol edit <name>`
adds, removes or reorders actions and renames the protocol; changes are saved
when you press Enter to finish, and Ctrl+C discards them.
`protocol delete <name>` removes one. They are stored in the configuration
file, where they can also be edited by hand:

```json
{
  "protocols": {
    "browser": [
      { "label": "Open Google Chrome", "app": "Google Chrome" },
      { "label": "Open github.com", "open": "https://github.com/" },
      { "label": "Run: npm run dev", "run": "npm run dev", "wait": false }
    ]
  }
}
```

## Configuration

Jarek keeps its settings in `~/.config/jarek/config.json` (on Windows,
`%APPDATA%\jarek\config.json`). Everything in it can be changed from
`personalize`, so there is no need to edit it by hand.

## Options

Options go before the command.

| Option | What it does |
| --- | --- |
| `--city <name>` | Brief on a specific city for this run |
| `--units <metric\|imperial>` | Temperature units (default: from your country) |
| `--lang <code>` | Force the language (`en`, `it`) |
| `--no-sound` | Run without music or voice |
| `--no-net` | Skip weather and news, stay entirely local |
| `--fast` | Skip the sequence, go straight to the briefing |
| `--no-repl` | Exit after the briefing instead of waiting for commands |
| `--no-color` | Disable colour output |
| `-v`, `--version` | Print the version |
| `-h`, `--help` | Print the help |

## Language

Jarek speaks the language of the machine he runs on. On macOS that means the
system language, which outranks `LANG`: terminal emulators tend to set that
variable to `C.UTF-8` or `en_US.UTF-8` whatever language the Mac is actually
configured in. On other systems `LANG` decides.

`LC_ALL`, `LC_MESSAGES` and `--lang` override all of it — those are only ever
set on purpose.

English and Italian ship today. Anything else falls back to English completely,
dates and place names included.

## Requirements

- Node.js 20 or newer
- macOS, Linux or Windows

Sound uses whatever the system already has — `afplay` on macOS, `paplay`,
`aplay`, `ffplay` or `mpv` on Linux, PowerShell on Windows. If none is
available everything still runs, silently and on the same timing. Desktop
notifications use `osascript` on macOS and `notify-send` on Linux.

Jarek has **no runtime dependencies**. `npx jarek-system-inc` downloads one
package and starts.

## Network and privacy

Jarek contacts the network only for these:

- **Location** — [ipapi.co](https://ipapi.co) or [ipwho.is](https://ipwho.is),
  which derive an approximate city from your public IP address. Skipped when
  you set a city.
- **Weather** — [Open-Meteo](https://open-meteo.com), keyless.
- **Headlines** — [Euronews](https://www.euronews.com) when Jarek speaks
  Italian, for European coverage; the Google News United States edition when he
  speaks English.
- **Network check in `scan`** — a single request to Google's or Cloudflare's
  connectivity endpoint, to measure latency.

`bye` reads your local git repositories to count today's commits; nothing
leaves your machine. No account is needed and nothing is sent anywhere else.
`--no-net` runs the intro and briefing with no network at all.

## Development

```bash
npm test          # the test suite: Node's built-in runner, no dependencies
npm run demo      # re-record media/jarek.gif (needs vhs: brew install vhs)
```

Tests run on macOS, Linux and Windows, with Node 20 and 22, on every push.

## Credits

Music "Jarek" by Marco Sgaramella, used with his permission. Voice generated
with Kokoro-82M (Apache License 2.0). Logo in the FIGlet font "Slant". See
[CREDITS.md](CREDITS.md).

## Licence

Jarek is **proprietary software**. Copyright © 2026 frasntoro, all rights
reserved. You may download and run it for personal, non-commercial use; you may
not redistribute, modify or reuse it or its assets. The music and the voice
engine belong to their authors and are used with permission or under their own
licences. See [LICENSE](LICENSE) for the full terms.

## Author

Made by **frasntoro**.
