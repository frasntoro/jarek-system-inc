#!/bin/sh
# Records the README demo and turns it into media/jarek.gif.
#
# vhs 0.12 cannot encode GIFs with ffmpeg 9: it reports success and writes
# nothing. So vhs only captures frames, and ffmpeg assembles them here, at a
# lower frame rate with a shared palette to keep the file small.
set -e
cd "$(dirname "$0")/.."

rm -rf media/frames
vhs media/demo.tape

ffmpeg -hide_banner -loglevel error -y \
  -framerate 50 -i media/frames/frame-text-%05d.png \
  -framerate 50 -i media/frames/frame-cursor-%05d.png \
  -filter_complex "[0][1]overlay,fps=20,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" \
  media/jarek.gif

rm -rf media/frames
ls -lh media/jarek.gif
