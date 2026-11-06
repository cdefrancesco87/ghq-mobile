# Runs the development loop: one `claude -p` per round until the prompt reports
# "LOOP FINITO" or "LOOP FERMO".
$ErrorActionPreference = 'Stop'

# UTF-8 both ways, so the prompt's non-ASCII characters survive the pipe.
$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Set-Location (Join-Path $PSScriptRoot '..')
$prompt = Get-Content -Raw -Encoding UTF8 'docs/prompt-loop.md'
$round = 1

while ($true) {
    Write-Host "=== Giro $round ==="
    # The prompt goes through stdin: multi-line arguments with quotes break on Windows.
    $output = ($prompt | claude -p | Out-String)
    $status = $LASTEXITCODE
    Write-Host $output

    if ($status -ne 0) {
        Write-Host "claude exited with code ${status}: loop stopped." -ForegroundColor Red
        exit $status
    }
    if ($output -match 'LOOP FINITO|LOOP FERMO') {
        exit 0
    }
    $round++
}
