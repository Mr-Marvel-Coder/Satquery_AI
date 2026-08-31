<#
  SatQuery AI — development launcher
  Team QUANTARA

  Starts the FastAPI backend and the Vite frontend in this one console.
  Both inherit this window, so their logs interleave live and Ctrl+C stops
  both at once.

  Usage
    .\dev.ps1                 backend + frontend
    .\dev.ps1 -FrontendOnly   frontend only (backend is on Colab/ngrok)
    .\dev.ps1 -Mock           frontend only, VITE_MOCK=1, no backend at all
    .\dev.ps1 -Port 8001      move the backend off 8000
    .\dev.ps1 -Setup          create the venv / install deps, then start

  First run: use -Setup. After that plain .\dev.ps1 is enough.
#>
param(
  [switch]$FrontendOnly,
  [switch]$Mock,
  [switch]$Setup,
  [int]$Port = 8000
)

$ErrorActionPreference = 'Stop'
$root     = $PSScriptRoot
$backend  = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'
$venvPy   = Join-Path $backend '.venv\Scripts\python.exe'

function Say($msg, $colour = 'Gray') { Write-Host $msg -ForegroundColor $colour }

# ---------------------------------------------------------------- validate --
if (-not (Test-Path $frontend)) {
  Say "No frontend\ folder here. Run this from the repo root." Red
  exit 1
}
if ($Mock) { $FrontendOnly = $true }

# ------------------------------------------------------------------- setup --
if ($Setup) {
  Say "`nSetting up" Cyan

  if (-not $FrontendOnly) {
    if (-not (Test-Path $venvPy)) {
      Say "  creating backend\.venv"
      python -m venv (Join-Path $backend '.venv')
    }
    Say "  installing python deps"
    & $venvPy -m pip install --upgrade pip --quiet
    & $venvPy -m pip install -r (Join-Path $backend 'requirements.txt') --quiet
  }

  Say "  installing node deps"
  Push-Location $frontend
  try { & npm install --no-fund --no-audit } finally { Pop-Location }

  Say "  done`n" Green
}

# Fail early with a fixable message rather than a stack trace 20s in.
if (-not $FrontendOnly -and -not (Test-Path $venvPy)) {
  Say "No backend\.venv found. Run:  .\dev.ps1 -Setup" Yellow
  Say "Or, if the backend lives on Colab:  .\dev.ps1 -FrontendOnly" DarkGray
  exit 1
}
if (-not (Test-Path (Join-Path $frontend 'node_modules'))) {
  Say "No frontend\node_modules found. Run:  .\dev.ps1 -Setup" Yellow
  exit 1
}

if (-not $FrontendOnly) {
  $busy = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if ($busy) {
    Say "Port $Port is already in use (PID $($busy[0].OwningProcess))." Yellow
    Say "Stop it, or start on another port:  .\dev.ps1 -Port 8001" DarkGray
    exit 1
  }
}

# ------------------------------------------------------------------- start --
$procs = @()

Say ""
Say "  SatQuery AI  ·  Team QUANTARA" Cyan
Say "  ---------------------------------------------"
if ($FrontendOnly) {
  if ($Mock) { Say "  backend    mock data (VITE_MOCK=1)" DarkGray }
  else       { Say "  backend    external - see VITE_API_URL in frontend\.env" DarkGray }
} else {
  Say "  backend    http://localhost:$Port        (docs at /docs)"
}
Say "  frontend   http://localhost:5173"
Say "  ---------------------------------------------"
Say "  Ctrl+C stops both.`n" DarkGray

try {
  if (-not $FrontendOnly) {
    $procs += Start-Process -PassThru -NoNewWindow `
      -FilePath $venvPy -WorkingDirectory $backend `
      -ArgumentList @(
        '-m', 'uvicorn', 'app.main:app',
        '--reload', '--host', '0.0.0.0', '--port', "$Port"
      )
    # Give uvicorn a moment to bind before Vite floods the console.
    Start-Sleep -Milliseconds 1200
  }

  $env:FORCE_COLOR = '1'
  if ($Mock) { $env:VITE_MOCK = '1' }

  $procs += Start-Process -PassThru -NoNewWindow `
    -FilePath $env:ComSpec -WorkingDirectory $frontend `
    -ArgumentList @('/c', 'npm run dev')

  Wait-Process -Id ($procs | ForEach-Object { $_.Id })
}
finally {
  Say "`nStopping…" DarkGray
  foreach ($p in $procs) {
    if ($p -and -not $p.HasExited) {
      # taskkill /T so uvicorn's reloader child and npm's node child go too.
      & taskkill /PID $p.Id /T /F 2>&1 | Out-Null
    }
  }
  Remove-Item Env:\VITE_MOCK -ErrorAction SilentlyContinue
  Say "Stopped.`n" DarkGray
}
