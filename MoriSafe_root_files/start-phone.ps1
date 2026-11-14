# Makes MoriSafe reachable from any phone over HTTPS, while this PC is on.
#   App:   https://<random>.trycloudflare.com/
#   Admin: https://<random>.trycloudflare.com/admin
# Run:  powershell -ExecutionPolicy Bypass -File start-phone.ps1     (Ctrl+C or close the windows to stop)
# The link changes every time this script starts.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$py = Join-Path $root "server\.venv\Scripts\python.exe"

if ((Get-Content (Join-Path $root "server\.env") -Raw) -match "PASTE-SERVICE-ROLE-KEY-HERE") {
  Write-Host "server\.env still needs your Supabase service_role key." -ForegroundColor Red; exit 1
}
$cf = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $cf) { $cf = @("C:\Program Files (x86)\cloudflared\cloudflared.exe", "C:\Program Files\cloudflared\cloudflared.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1 }
if (-not $cf) { Write-Host "Installing cloudflared..."; winget install -e --id Cloudflare.cloudflared --silent --accept-package-agreements --accept-source-agreements; $cf = "C:\Program Files (x86)\cloudflared\cloudflared.exe" }

# 1. Build the app and dashboard so the server can serve them (same address = no extra setup).
Write-Host "Building the app and admin website..."
# --mode phone loads .env.phone, which blanks VITE_API_URL (PowerShell cannot set an empty env var).
foreach ($d in "app", "admin") {
  Push-Location (Join-Path $root $d)
  if (-not (Test-Path node_modules)) { npm install --no-audit --no-fund | Out-Null }
  npx vite build --mode phone | Out-Null
  Pop-Location
}
$site = Join-Path $root "server\site"
if (Test-Path $site) { Remove-Item -Recurse -Force $site }
New-Item -ItemType Directory $site | Out-Null
Copy-Item -Recurse (Join-Path $root "app\dist") (Join-Path $site "app")
Copy-Item -Recurse (Join-Path $root "admin\dist") (Join-Path $site "admin")

# 2. Server, only reachable from this PC; the tunnel is the way in. Trust forwarded client IPs from the tunnel only.
$busy = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($busy) { Write-Host "Port 8000 is already in use. Close the other MoriSafe server window first." -ForegroundColor Red; exit 1 }
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\server'; & '$py' -m uvicorn server:app --host 127.0.0.1 --port 8000 --proxy-headers --forwarded-allow-ips 127.0.0.1"
Start-Sleep 4

# 3. HTTPS tunnel. Print the address once cloudflared reports it.
$log = Join-Path $env:TEMP "morisafe-tunnel.log"
if (Test-Path $log) { Remove-Item $log }
Start-Process $cf -ArgumentList "tunnel", "--no-autoupdate", "--url", "http://127.0.0.1:8000", "--logfile", "`"$log`"" -WindowStyle Minimized
$url = $null
for ($i = 0; $i -lt 60 -and -not $url; $i++) {
  Start-Sleep 1
  if (Test-Path $log) { $m = Select-String -Path $log -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" | Select-Object -First 1; if ($m) { $url = $m.Matches[0].Value } }
}
if (-not $url) { Write-Host "The tunnel did not start. See $log" -ForegroundColor Red; exit 1 }
Set-Clipboard $url
Write-Host ""
Write-Host "MoriSafe is online:" -ForegroundColor Green
Write-Host "  Phones (app):  $url"
Write-Host "  Admin:         $url/admin"
Write-Host "  (link copied to clipboard; it stays up while this PC and the two windows are running)"
Start-Process "$url/admin"
