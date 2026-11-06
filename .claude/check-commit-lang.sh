#!/usr/bin/env bash
# Hook: reject git commit messages that are not in English.
# Receives hook JSON on stdin; exits 2 + prints JSON to block the commit.

input=$(cat)
cmd=$(jq -r '.tool_input.command // ""' <<< "$input")

# Extract the value of the -m flag (handles both single and double quotes).
msg=$(grep -oP '(?<=-m ")[^"]+' <<< "$cmd" | head -1)
[ -z "$msg" ] && msg=$(grep -oP "(?<=-m ')[^']+" <<< "$cmd" | head -1)

# No -m flag → nothing to check (--file / COMMIT_EDITMSG path), allow.
[ -z "$msg" ] && exit 0

# Italian indicators:
#   1. Accented Italian vowels  àèéìòùÀÈÉÌÒÙ
#   2. Italian article contractions  del/della/dei/degli/delle/dal/dagli/dalle
#   3. Domain-specific Italian words seen in this project's history
if grep -qiP \
  '[àèéìòùÀÈÉÌÒÙ]|\b(dei|degli|delle|dal|dagli|dalle|del|della)\b|\b(negozio|giornata|missioni|ricostruzione|annullare|chiudere|chiusura|giorni|gestione|registro|schermata|impostazioni|tema|aggiornamento|eseguire|calcolo|partita|giro|limiti|raggiunto|scelto|leggero|riprovo|aspetta|attesa|errore|modello)\b' \
  <<< "$msg"; then
  printf '{"decision":"block","reason":"Commit message is not in English (\"%s\"). Please rewrite it in English before committing."}' "$msg"
  exit 2
fi

exit 0
