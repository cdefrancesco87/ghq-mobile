#!/usr/bin/env bash
# Un task per giro, ogni giro con un contesto nuovo.
# Opus fino al T26 (regole e database), Sonnet dopo.
cd "$(dirname "$0")/.."
while true; do
  if grep -q '^### \[x\] T26' docs/backlog-task.md; then model=sonnet; else model=opus; fi
  echo ">>> Giro con $model"
  out=$(claude -p "$(cat docs/prompt-loop.md)" --model "$model" --effort high 2>&1); code=$?
  echo "$out"
  if [ $code -ne 0 ] || echo "$out" | grep -qiE "usage limit|limit reached|rate limit"; then
    echo ">>> Limite raggiunto o errore: riprovo tra 30 minuti (Ctrl+C per fermare)"
    sleep 1800; continue
  fi
  echo "$out" | grep -qE "LOOP (FINITO|FERMO)" && break
done
