<#
.SYNOPSIS
  Starts/stops the local background services the API needs (PostgreSQL, Redis).

.DESCRIPTION
  This machine has no Docker and no WSL distro, so `docker compose up` cannot be
  used. Instead this script drives the portable PostgreSQL 16 build that already
  lives in .local\pgsql against the initialized data directory in .local\pgdata.

  It is idempotent: running `start` when the server is already up is a no-op, so
  it is safe to wire into a `predev` hook.

  Redis is optional for authentication (the auth module never touches Redis --
  only the BullMQ scraper/notification queues do). If a portable Redis is present
  at .local\redis\redis-server.exe it is started too; otherwise the script warns
  and still exits 0 so it never blocks `pnpm dev`.

.PARAMETER Action
  start | stop | status

.EXAMPLE
  pnpm run services:up
  pnpm run services:down
  pnpm run services:status
#>
[CmdletBinding()]
param(
  [ValidateSet('start', 'stop', 'status')]
  [string]$Action = 'start'
)

$ErrorActionPreference = 'Stop'

# Resolve paths relative to the repo root (this script lives in <root>\scripts).
$RepoRoot = Split-Path -Parent $PSScriptRoot
$PgBin    = Join-Path $RepoRoot '.local\pgsql\bin'
$PgData   = Join-Path $RepoRoot '.local\pgdata'
$PgLog    = Join-Path $RepoRoot '.local\pg.log'
$RedisDir = Join-Path $RepoRoot '.local\redis'
$PgPort   = 5432
$RedisPort = 6379

function Write-Ok    ([string]$m) { Write-Host "  [ok]   $m"   -ForegroundColor Green }
function Write-Info  ([string]$m) { Write-Host "  [info] $m"   -ForegroundColor Cyan }
function Write-Warn2 ([string]$m) { Write-Host "  [warn] $m"   -ForegroundColor Yellow }
function Write-Err2  ([string]$m) { Write-Host "  [fail] $m"   -ForegroundColor Red }

function Test-PortListening([int]$Port) {
  # -State Listen avoids counting outbound/TIME_WAIT sockets on the same number.
  $null -ne (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1)
}

# ---------------------------------------------------------------- PostgreSQL --

function Start-Postgres {
  if (-not (Test-Path (Join-Path $PgBin 'pg_ctl.exe'))) {
    Write-Err2 "PostgreSQL binaries not found at $PgBin"
    return $false
  }
  if (-not (Test-Path (Join-Path $PgData 'PG_VERSION'))) {
    Write-Err2 "No initialized data directory at $PgData (run initdb first)"
    return $false
  }
  if (Test-PortListening $PgPort) {
    Write-Ok "postgres already listening on $PgPort"
    return $true
  }

  # A hard shutdown (or a killed terminal) leaves postmaster.pid behind, which
  # makes pg_ctl print "another server might be running". Clear it only when the
  # recorded PID is genuinely gone, so we never nuke a live server's pid file.
  $pidFile = Join-Path $PgData 'postmaster.pid'
  if (Test-Path $pidFile) {
    $stalePid = Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($stalePid -and -not (Get-Process -Id $stalePid -ErrorAction SilentlyContinue)) {
      Write-Info "removing stale postmaster.pid (dead pid $stalePid)"
      Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    }
  }

  Write-Info 'starting postgres...'
  # pg_ctl cannot open the log file if a previous postgres still holds the
  # handle; fall back to a timestamped log rather than failing the whole start.
  $logTarget = $PgLog
  try { [IO.File]::OpenWrite($PgLog).Close() } catch {
    $logTarget = Join-Path $RepoRoot (".local\pg-{0}.log" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
  }

  & (Join-Path $PgBin 'pg_ctl.exe') -D $PgData -l $logTarget -w -t 60 start 2>&1 |
    ForEach-Object { Write-Verbose $_ }

  Start-Sleep -Milliseconds 500
  if (Test-PortListening $PgPort) {
    Write-Ok "postgres listening on $PgPort  (log: $logTarget)"
    return $true
  }
  Write-Err2 "postgres failed to start -- see $logTarget"
  return $false
}

function Stop-Postgres {
  if (-not (Test-PortListening $PgPort)) { Write-Info 'postgres already stopped'; return }
  Write-Info 'stopping postgres...'
  # -m fast = roll back open transactions and shut down promptly, but still a
  # clean shutdown (unlike -m immediate, which forces crash recovery on boot).
  & (Join-Path $PgBin 'pg_ctl.exe') -D $PgData -m fast -w -t 60 stop 2>&1 |
    ForEach-Object { Write-Verbose $_ }
  if (Test-PortListening $PgPort) { Write-Warn2 'postgres still listening' }
  else { Write-Ok 'postgres stopped' }
}

# --------------------------------------------------------------------- Redis --

function Start-Redis {
  $exe = Join-Path $RedisDir 'redis-server.exe'
  if (Test-PortListening $RedisPort) { Write-Ok "redis already listening on $RedisPort"; return }
  if (-not (Test-Path $exe)) {
    Write-Warn2 "redis not installed (looked for $exe)"
    Write-Warn2 'Auth/login works without it; BullMQ queues will log ECONNREFUSED.'
    return
  }
  Write-Info 'starting redis...'
  $conf = Join-Path $RedisDir 'redis.windows.conf'
  $args = if (Test-Path $conf) { @($conf) } else { @() }
  Start-Process -FilePath $exe -ArgumentList $args -WorkingDirectory $RedisDir -WindowStyle Hidden | Out-Null
  Start-Sleep -Milliseconds 800
  if (Test-PortListening $RedisPort) { Write-Ok "redis listening on $RedisPort" }
  else { Write-Warn2 'redis did not come up' }
}

function Stop-Redis {
  if (-not (Test-PortListening $RedisPort)) { Write-Info 'redis already stopped'; return }
  Write-Info 'stopping redis...'
  Get-Process redis-server -ErrorAction SilentlyContinue | Stop-Process -Force
  Write-Ok 'redis stopped'
}

# -------------------------------------------------------------------- Status --

function Show-Status {
  $pg = if (Test-PortListening $PgPort) { 'UP  ' } else { 'DOWN' }
  $rd = if (Test-PortListening $RedisPort) { 'UP  ' } else { 'DOWN' }
  Write-Host ''
  Write-Host "  postgres  $pg  localhost:$PgPort"
  Write-Host "  redis     $rd  localhost:$RedisPort"
  Write-Host ''
}

# ---------------------------------------------------------------------- Main --

Write-Host ''
Write-Host "dev-services: $Action" -ForegroundColor Magenta

switch ($Action) {
  'start' {
    $pgOk = Start-Postgres
    Start-Redis
    Show-Status
    # Fail loudly only when Postgres is down: without it the API cannot serve a
    # single authenticated request, so `pnpm dev` should not proceed silently.
    if (-not $pgOk) { exit 1 }
  }
  'stop' {
    Stop-Redis
    Stop-Postgres
  }
  'status' { Show-Status }
}
