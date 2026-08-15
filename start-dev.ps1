# TILEARNED local dev stack launcher — starts backend + frontend, opens the UI.
$ErrorActionPreference = "Stop"

Write-Host "`n=== Starting TILEARNED backend (FastAPI on :8000) ===" -ForegroundColor Cyan
$backend = Start-Process -FilePath "backend\.venv\Scripts\python.exe" -ArgumentList "-m","uvicorn","app.main:app","--host","0.0.0.0","--port","8000" -WorkingDirectory "backend" -WindowStyle Hidden -PassThru -RedirectStandardOutput "backend\server.log" -RedirectStandardError "backend\server.err.log"
Write-Host "Backend PID: $($backend.Id) (logs: backend\server.log)"

Write-Host "`n=== Starting TILEARNED frontend (Next.js on :3000) ===" -ForegroundColor Cyan
$frontend = Start-Process -FilePath "cmd.exe" -ArgumentList "/c","npm run dev > frontend.log 2>&1" -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
Write-Host "Frontend PID: $($frontend.Id) (logs: frontend.log)"

Write-Host "`nWaiting for servers to come up..." -ForegroundColor Yellow
$backendOk = $false
$frontendOk = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    if (-not $backendOk) {
        try { Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/health" -TimeoutSec 2 | Out-Null; $backendOk = $true } catch {}
    }
    if (-not $frontendOk) {
        try { Invoke-WebRequest -Uri "http://127.0.0.1:3000" -TimeoutSec 2 | Out-Null; $frontendOk = $true } catch {}
    }
    if ($backendOk -and $frontendOk) { break }
}

if ($backendOk)  { Write-Host "`nBackend  OK  -> http://127.0.0.1:8000/docs" -ForegroundColor Green }
else             { Write-Host "`nBackend  FAILED (check backend\server.err.log)" -ForegroundColor Red }
if ($frontendOk) { Write-Host "Frontend OK  -> http://127.0.0.1:3000" -ForegroundColor Green }
else             { Write-Host "Frontend FAILED (check frontend.log)" -ForegroundColor Red }

if ($backendOk -and $frontendOk) {
    Write-Host "`nOpening UI in browser..." -ForegroundColor Cyan
    Start-Process "http://127.0.0.1:3000"
}
