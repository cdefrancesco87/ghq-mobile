#!/usr/bin/env bash
# Runs the development loop: one `claude -p` per round until the prompt reports
# "LOOP FINITO" or "LOOP FERMO".
set -uo pipefail

cd "$(dirname "$0")/.."
prompt="$(cat docs/prompt-loop.md)"
round=1

while true; do
  echo "=== Giro $round ==="
  output="$(claude -p "$prompt")"
  status=$?
  echo "$output"

  if [ $status -ne 0 ]; then
    echo "claude è uscito con codice $status: loop interrotto." >&2
    exit $status
  fi
  if grep -qE 'LOOP FINITO|LOOP FERMO' <<<"$output"; then
    exit 0
  fi
  round=$((round + 1))
done
