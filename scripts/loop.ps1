# Runs the development loop: one `claude -p` per round until the prompt reports
# "LOOP FINITO" or "LOOP FERMO". On errors or usage limits it waits 30 minutes
# and retries the round.
$ErrorActionPreference = 'Stop'

# UTF-8 both ways, so the prompt's non-ASCII characters survive the pipe.
$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Set-Location (Join-Path $PSScriptRoot '..')
$prompt = Get-Content -Raw -Encoding UTF8 'docs/prompt-loop.md'

while ($true) {
    # Sonnet once T26 is done, Opus before. Checked every round: the backlog changes.
    if (Select-String -Path 'docs/backlog-task.md' -Pattern '^### \[x\] T26' -Quiet) {
        $model = 'sonnet'
    } else {
        $model = 'opus'
    }
    Write-Host ">>> Giro con $model"
    # The prompt goes through stdin: multi-line arguments with quotes break on Windows.
    # stderr is captured too; with 'Stop' its lines would end the script.
    $ErrorActionPreference = 'Continue'
    $output = ($prompt | claude -p --model $model --effort high 2>&1 | ForEach-Object { "$_" } | Out-String)
    $status = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    Write-Host $output

    if ($status -ne 0 -or $output -match 'usage limit|limit reached|rate limit') {
        Write-Host '>>> Limite raggiunto o errore: riprovo tra 30 minuti (Ctrl+C per fermare)' -ForegroundColor Yellow
        Start-Sleep -Seconds 1800
        continue
    }
    if ($output -match 'LOOP FINITO|LOOP FERMO') {
        exit 0
    }
}
