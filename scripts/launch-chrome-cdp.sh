#!/bin/bash
# Launch Chrome with CDP that PERSISTS
nohup "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.hermes/chrome-debug" \
  --no-first-run \
  --no-default-browser-check \
  > /dev/null 2>&1 &
echo "Chrome launched. PID: $!"
