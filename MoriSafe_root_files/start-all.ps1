# Starts the MoriSafe API (:8000), admin website (:5173/admin) and public app (:5174), each in its own window.
# Run:  powershell -ExecutionPolicy Bypass -File start-all.ps1
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$py = Join-Path $root "server\.venv\Scripts\python.exe"

if (-not (Test-Path $py)) {
  Write-Host "Setting up the Python environment (first run only)..."
  $base = "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe"
  if (-not (Test-Path $base)) { $base = "python" }
  & $base -m venv (Join-Path $root "server\.venv")
  & $py -m pip install -q -r (Join-Path $root "server\requirements.txt")
}
foreach ($d in "app", "admin") {
  if (-not (Test-Path (Join-Path $root "$d\node_modules"))) { Push-Location (Join-Path $root $d); npm install --no-audit --no-fund; Pop-Location }
}
if ((Get-Content (Join-Path $root "server\.env") -Raw) -match "PASTE-SERVICE-ROLE-KEY-HERE") {
  Write-Host "server\.env still needs your Supabase service_role key. Paste it in, then run this again." -ForegroundColor Red
  exit 1
}

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\server'; & '$py' -m uvicorn server:app --host 0.0.0.0 --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\admin'; npx vite --port 5175"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\app'; npm run dev"

Start-Sleep 4
Write-Host ""
Write-Host "API health:      http://localhost:8000/api/health"
Write-Host "Admin website:   http://localhost:5175/admin"
Write-Host "Public app:      http://localhost:5174"
Start-Process "http://localhost:5175/admin"
