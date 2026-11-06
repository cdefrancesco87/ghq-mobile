#!/usr/bin/env bash
# Runs the development loop: one `claude -p` per round until the prompt reports
# "LOOP FINITO" or "LOOP FERMO".
set -uo pipefail

cd "$(dirname "$0")/.."
prompt="$(cat docs/prompt-loop.md)"

while true; do
  # Sonnet once T26 is done, Opus before. Checked every round: the backlog changes.
  if grep -q '^### \[x\] T26' docs/backlog-task.md; then
    model=sonnet
  else
    model=opus
  fi
  echo ">>> Giro con $model"
  output="$(claude -p "$prompt" --model "$model" --effort high)"
  status=$?
  echo "$output"

  if [ $status -ne 0 ]; then
    echo "claude è uscito con codice $status: loop interrotto." >&2
    exit $status
  fi
  if grep -qE 'LOOP FINITO|LOOP FERMO' <<<"$output"; then
    exit 0
  fi
done
