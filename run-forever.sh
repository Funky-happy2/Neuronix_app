#!/bin/bash
# Keeps the Neuronix server running forever — if it ever crashes, it restarts
# automatically after 2 seconds. Run it in your OWN terminal so it keeps going
# even after Claude's session ends:
#
#   nohup ./run-forever.sh > server.log 2>&1 &
#
# To stop it later:  pkill -f run-forever.sh
cd "$(dirname "$0")" || exit 1
while true; do
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting Neuronix server..."
  ./start-server.sh
  code=$?
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Server exited (code $code). Restarting in 2s..."
  sleep 2
done
