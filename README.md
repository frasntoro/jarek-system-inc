# Jarek

A cinematic boot sequence for your terminal.

Type `jarek`. The music starts, the logo lands on the first beat, and the
systems come online one by one — in time with the track. When the music fades,
Jarek tells you what you actually need to know: the time, the weather where you
are, the headlines of the hour.

It is the Iron Man morning scene, in a terminal, in about twenty seconds.

```
       _____    ____  ________ __
      / /   |  / __ \/ ____/ //_/
 __  / / /| | / /_/ / __/ / ,<
/ /_/ / ___ |/ _, _/ /___/ /| |
\____/_/  |_/_/ |_/_____/_/ |_|
  at your service

  [ OK ] Initializing core systems
  [ OK ] Routing power to the arc reactor
  [ OK ] Brewing coffee, Sir
  [ OK ] Establishing satellite uplink
  [ OK ] Reading atmospheric sensors
  [ OK ] Scanning global news feeds
  [ OK ] All systems online
  ██████████████████████████████████ 100%

Good morning, Sir.
It is 08:42 on Wednesday, 16 September.

Milan, Italy
21°C, clear sky. Feels like 23°C.
Tomorrow: 19°C to 25°C, 80% chance of rain.

Headlines this hour:
  • ...

Local systems nominal — up 5h 15m, 36 of 64 GB free.

Have a good day, Sir.
```

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

Put it at the end of your `~/.zshrc` and your terminal greets you every
morning. Press any key during the sequence to skip ahead to the briefing.

## Options

| Option | What it does |
| --- | --- |
| `--city <name>` | Brief on a specific city instead of your own location |
| `--units <metric\|imperial>` | Temperature units (default: `metric`) |
| `--lang <code>` | Force the language (`en`, `it`) |
| `--no-sound` | Run the sequence without music |
| `--no-net` | Skip weather and news, stay entirely local |
| `--fast` | Skip the sequence, go straight to the briefing |
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
available the sequence still runs, silently and on the same timing.

Jarek has **no runtime dependencies**. `npx jarek-system-inc` downloads one package and
starts.

## Network and privacy

Jarek makes three kinds of request, and only to render the briefing:

- **Location** — [ipapi.co](https://ipapi.co) or [ipwho.is](https://ipwho.is),
  which derive an approximate city from your public IP address.
- **Weather** — [Open-Meteo](https://open-meteo.com), keyless.
- **Headlines** — [Euronews](https://www.euronews.com) when Jarek speaks
  Italian, for European coverage; the Google News United States edition when he
  speaks English.

Nothing is stored, no account is needed, and no data is sent anywhere else.
Use `--city` to skip the location lookup, or `--no-net` to run with no network
at all.

## Licence

Jarek is **proprietary software**. Copyright © 2026 frasntoro, all rights
reserved. You may download and run it for personal, non-commercial use; you may
not redistribute, modify or reuse it or its assets. See [LICENSE](LICENSE) for
the full terms.

## Author

Made by **frasntoro**.
