# The README demo, recorded with vhs (https://github.com/charmbracelet/vhs).
#
#   brew install vhs
#   npm run demo            # writes media/jarek.gif, through media/render.sh
#
# vhs only captures the frames here; media/render.sh assembles the GIF.
#
# It runs against media/demo-config, so your own configuration is never
# touched and the recording is the same on every machine. GIFs carry no
# sound, so music and voice are switched off.

Output media/frames/

Require node

Set Shell "bash"
Set FontSize 18
Set Width 1200
Set Height 820
Set Padding 28
Set Theme "Catppuccin Mocha"
Set TypingSpeed 55ms
Set CursorBlink false

Env XDG_CONFIG_HOME "media/demo-config"
# An empty home, so `bye` cannot list the recording machine's private repositories.
Env HOME "/tmp/jarek-demo-home"
Env COLORTERM "truecolor"

# Behind the scenes: make `jarek` mean this working copy.
Hide
Type 'alias jarek="node bin/jarek.js"'
Enter
Type "clear"
Enter
Show

# The boot sequence and the briefing.
Type "jarek --lang en --no-sound"
Sleep 500ms
Enter
Sleep 22s

# Diagnostics.
Type "scan"
Sleep 400ms
Enter
Sleep 5s

# A very short focus session, to show the bar reach zero.
Type "focus 0.1"
Sleep 400ms
Enter
Sleep 8s

# The screensaver, then back.
Type "break"
Sleep 400ms
Enter
Sleep 8s
Type "x"
Sleep 1s

# Power down.
Type "bye"
Sleep 400ms
Enter
Sleep 5s
