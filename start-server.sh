#!/bin/bash
# Neuronix server launcher. Used by the launchd service so the site stays up
# (auto-restarts on crash, starts at login). You can also run this directly:
#   ./start-server.sh
cd "$(dirname "$0")" || exit 1

# Make sure node + postgres tools are on PATH (launchd has a minimal PATH).
export PATH="/opt/homebrew/bin:/opt/homebrew/opt/postgresql@16/bin:/usr/local/bin:/usr/bin:/bin"

export DATABASE_URL="postgresql://facaishu@localhost:5432/neuronix"
export PORT="${PORT:-5050}"
export NODE_ENV=development

# Free the Vite HMR port (24678) in case a previous instance hasn't released it
# yet — otherwise a fast restart crashes with "port already in use".
lsof -nP -tiTCP:24678 2>/dev/null | xargs kill -9 2>/dev/null
lsof -nP -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | xargs kill -9 2>/dev/null
sleep 1

exec ./node_modules/.bin/tsx server/index.ts
