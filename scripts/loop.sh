#!/usr/bin/env bash
# Runs the development loop: one `claude -p` per round until the prompt reports
# "LOOP FINITO" or "LOOP FERMO". On errors or usage limits it waits 30 minutes
# and retries the round.
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
  output="$(claude -p "$prompt" --model "$model" --effort high 2>&1)"
  status=$?
  echo "$output"

  if [ $status -ne 0 ] || grep -qiE 'usage limit|limit reached|rate limit' <<<"$output"; then
    echo ">>> Limite raggiunto o errore: riprovo tra 30 minuti (Ctrl+C per fermare)"
    sleep 1800
    continue
  fi
  if grep -qE 'LOOP FINITO|LOOP FERMO' <<<"$output"; then
    exit 0
  fi
done
