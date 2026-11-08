# Un task per giro, ogni giro con un contesto nuovo.
# Opus fino al T26 (regole e database), Sonnet dopo.
Set-Location (Join-Path $PSScriptRoot "..")
while ($true) {
  if (Select-String -Path docs/backlog-task.md -Pattern '^### \[x\] T26' -Quiet) { $model = "sonnet" } else { $model = "opus" }
  Write-Output ">>> Giro con $model"
  $out = claude -p (Get-Content docs/prompt-loop.md -Raw) --model $model --effort high 2>&1 | Out-String
  $code = $LASTEXITCODE
  Write-Output $out
  if ($code -ne 0 -or $out -match "(?i)usage limit|limit reached|rate limit") {
    Write-Output ">>> Limite raggiunto o errore: riprovo tra 30 minuti (Ctrl+C per fermare)"
    Start-Sleep -Seconds 1800; continue
  }
  if ($out -match "LOOP (FINITO|FERMO)") { break }
}
