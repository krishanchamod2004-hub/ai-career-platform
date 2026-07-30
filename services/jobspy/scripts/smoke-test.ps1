<#
.SYNOPSIS
    Unattended smoke test for the JobSpy sidecar.

.DESCRIPTION
    Boots the FastAPI service on a throwaway port, waits for /health, runs one
    real POST /search-jobs against Indeed, prints the result, then shuts the
    server down and removes its temp logs. Exit code 0 = jobs were returned.

.EXAMPLE
    .\.venv\Scripts\Activate.ps1   # not required; the script uses the venv python directly
    powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1
#>
param(
    [int]$Port = 8123,
    [string]$SearchTerm = "software engineer",
    [string]$Location = "New York, NY",
    [string]$Site = "indeed",
    [int]$ResultsWanted = 5,
    [int]$TimeoutSeconds = 200
)

$ErrorActionPreference = "Stop"
$serviceRoot = Split-Path -Parent $PSScriptRoot
$python = Join-Path $serviceRoot ".venv\Scripts\python.exe"
$outLog = Join-Path $serviceRoot ".smoke-out.log"
$errLog = Join-Path $serviceRoot ".smoke-err.log"

if (-not (Test-Path $python)) {
    throw "venv python not found at $python - create it with: ..\..\.local\python312\python.exe -m venv .venv"
}

function Stop-Leftovers {
    # Kill anything already bound to the smoke port so reruns are idempotent.
    $conns = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
    foreach ($conn in $conns) {
        Write-Host "Stopping leftover listener on port $Port (pid $($conn.OwningProcess))"
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    Remove-Item (Join-Path $serviceRoot ".smoke-pid.txt") -Force -ErrorAction SilentlyContinue
}

Stop-Leftovers
Remove-Item $outLog, $errLog -Force -ErrorAction SilentlyContinue

# Ephemeral token: the service refuses to start unauthenticated by design.
$bytes = New-Object byte[] 24
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$env:JOBSPY_API_TOKEN = -join ($bytes | ForEach-Object { $_.ToString("x2") })
$env:JOBSPY_VERBOSE = "2"

$server = Start-Process -FilePath $python `
    -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "$Port" `
    -WorkingDirectory $serviceRoot -PassThru `
    -RedirectStandardOutput $outLog -RedirectStandardError $errLog

Write-Host "Started uvicorn pid $($server.Id) on port $Port"
$exitCode = 1

try {
    $ready = $false
    foreach ($attempt in 1..30) {
        Start-Sleep -Seconds 1
        if ($server.HasExited) { throw "server exited early with code $($server.ExitCode)" }
        try {
            $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 5
            $ready = $true
            break
        } catch { }
    }
    if (-not $ready) { throw "service did not become healthy within 30s" }

    Write-Host ""
    Write-Host "=== /health ==="
    $health | ConvertTo-Json -Depth 5

    $body = @{
        search_term    = $SearchTerm
        location       = $Location
        sites          = @($Site)
        results_wanted = $ResultsWanted
        country_indeed = "USA"
    } | ConvertTo-Json

    Write-Host ""
    Write-Host "=== POST /search-jobs ($Site, results_wanted=$ResultsWanted) ==="
    Write-Host "request: $body"
    $started = Get-Date

    $response = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/search-jobs" `
        -Method Post -Body $body -ContentType "application/json" `
        -Headers @{ "X-JobSpy-Token" = $env:JOBSPY_API_TOKEN } `
        -TimeoutSec $TimeoutSeconds

    $wall = [int]((Get-Date) - $started).TotalMilliseconds
    Write-Host ""
    Write-Host "total=$($response.total) skipped=$($response.skipped) elapsedMs=$($response.elapsedMs) wallMs=$wall"
    Write-Host "countsBySite: $($response.countsBySite | ConvertTo-Json -Compress)"
    if ($response.warnings.Count -gt 0) {
        foreach ($warning in $response.warnings) { Write-Host "WARNING: $warning" }
    }

    $index = 0
    foreach ($job in $response.jobs) {
        $index++
        $descLen = 0
        if ($job.descriptionHtml) { $descLen = $job.descriptionHtml.Length }
        elseif ($job.descriptionText) { $descLen = $job.descriptionText.Length }
        Write-Host ""
        Write-Host "--- job $index ---"
        Write-Host "  site         : $($job.site)"
        Write-Host "  sourceJobId  : $($job.sourceJobId)"
        Write-Host "  title        : $($job.title)"
        Write-Host "  companyName  : $($job.companyName)"
        Write-Host "  locationText : $($job.locationText)"
        Write-Host "  isRemote     : $($job.isRemote)"
        Write-Host "  employment   : $($job.employmentType)"
        Write-Host "  salary       : $($job.salaryText) [min=$($job.salaryMin) max=$($job.salaryMax) cur=$($job.salaryCurrency)]"
        Write-Host "  postedAt     : $($job.postedAt)"
        Write-Host "  url          : $($job.url)"
        Write-Host "  descriptionLen: $descLen chars"
        Write-Host "  tags         : $($job.tags -join ', ')"
    }

    # Contract assertions: every row the Node pipeline needs must be present.
    $missing = $response.jobs | Where-Object { -not $_.title -or -not $_.companyName -or -not $_.url }
    if ($missing) { throw "$($missing.Count) job(s) missing required title/companyName/url" }

    if ($response.total -gt 0) {
        Write-Host ""
        Write-Host "SMOKE TEST PASSED: $($response.total) real listing(s) fetched and mapped."
        $exitCode = 0
    } else {
        Write-Host ""
        Write-Host "SMOKE TEST INCONCLUSIVE: request succeeded but 0 listings returned (likely rate limit / IP block)."
    }
} catch {
    Write-Host ""
    Write-Host "SMOKE TEST FAILED: $_"
    if ($_.ErrorDetails.Message) { Write-Host "response body: $($_.ErrorDetails.Message)" }
} finally {
    if (-not $server.HasExited) {
        Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Milliseconds 500

    Write-Host ""
    Write-Host "=== server stdout ==="
    if (Test-Path $outLog) { Get-Content $outLog }
    Write-Host "=== server stderr (uvicorn logs here by default) ==="
    if (Test-Path $errLog) { Get-Content $errLog }

    Remove-Item $outLog, $errLog -Force -ErrorAction SilentlyContinue
    Remove-Item Env:\JOBSPY_API_TOKEN -ErrorAction SilentlyContinue
    Remove-Item Env:\JOBSPY_VERBOSE -ErrorAction SilentlyContinue
}

exit $exitCode
