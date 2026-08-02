# Download and setup Redis for Windows
$redisDir = "D:\ReactJapp\temp\redis"
$redisZip = "$redisDir\redis.zip"
$redisUrl = "https://github.com/tporadowski/redis/releases/download/v5.0.14.1/Redis-x64-5.0.14.1.zip"

# Create directory
New-Item -ItemType Directory -Force -Path $redisDir | Out-Null

Write-Host "Downloading Redis..."
$webClient = New-Object System.Net.WebClient
$webClient.DownloadFile($redisUrl, $redisZip)

if (Test-Path $redisZip) {
    Write-Host "Extracting Redis..."
    Expand-Archive -Path $redisZip -DestinationPath $redisDir -Force
    
    Write-Host "Starting Redis server..."
    Start-Process -FilePath "$redisDir\redis-server.exe" -ArgumentList "--port 6379" -WindowStyle Minimized
    
    Write-Host "Redis server started on port 6379"
    Write-Host "Waiting for Redis to initialize..."
    Start-Sleep -Seconds 3
} else {
    Write-Host "Download failed"
    exit 1
}
