param(
    [string]$RepoRoot = "D:\GitHub\smart-metering-playwright-tests",
    [string]$Distro = "Ubuntu-24.04",
    [switch]$NoBuild
)

$ErrorActionPreference = "Stop"

$LinuxRepo = "/mnt/d/GitHub/smart-metering-playwright-tests"
$RuntimeRoot = Join-Path $RepoRoot ".k8s-runtime"
$KeepAlivePidFile = Join-Path $RuntimeRoot "wsl-k8s-keepalive.pid"
$PortForwardPidFile = Join-Path $RuntimeRoot "port-forward-pids.txt"

New-Item -ItemType Directory -Path $RuntimeRoot -Force | Out-Null

function Invoke-Wsl {
    param([string]$Command)

    & wsl.exe -d $Distro -- bash -lc "cd '$LinuxRepo' && $Command"

    if ($LASTEXITCODE -ne 0) {
        throw "WSL command failed: $Command"
    }
}

Set-Location -LiteralPath $RepoRoot

$keepAlive = Start-Process `
    -FilePath "wsl.exe" `
    -ArgumentList @("-d", $Distro, "--", "sleep", "infinity") `
    -WindowStyle Hidden `
    -PassThru

[System.IO.File]::WriteAllText(
    $KeepAlivePidFile,
    [string]$keepAlive.Id,
    (New-Object System.Text.UTF8Encoding($false))
)

Invoke-Wsl "bash ./scripts/k8s/create-cluster.sh"

if (-not $NoBuild) {
    Invoke-Wsl "bash ./scripts/k8s/build-load-images.sh"
}

Invoke-Wsl "bash ./scripts/k8s/deploy.sh"

$kubectl = "$LinuxRepo/.tools/k8s/kubectl"

$mappings = @(
    @{ Resource = "service/backend"; Port = "18080:8080"; Name = "backend" },
    @{ Resource = "service/frontend"; Port = "8088:80"; Name = "frontend" },
    @{ Resource = "service/mqtt-broker"; Port = "1883:1883"; Name = "mqtt" },
    @{ Resource = "service/mqtt-ingestion"; Port = "18090:8090"; Name = "mqtt-ingestion" },
    @{ Resource = "service/kafka-event-service"; Port = "18100:8100"; Name = "kafka-event-service" },
    @{ Resource = "service/kafka"; Port = "29092:29092"; Name = "kafka" }
)

$pids = @()

foreach ($mapping in $mappings) {
    $process = Start-Process `
        -FilePath "wsl.exe" `
        -ArgumentList @(
            "-d",
            $Distro,
            "--",
            $kubectl,
            "-n",
            "smart-metering",
            "port-forward",
            $mapping.Resource,
            $mapping.Port,
            "--address",
            "0.0.0.0"
        ) `
        -RedirectStandardOutput (Join-Path $RuntimeRoot "$($mapping.Name)-pf.out.log") `
        -RedirectStandardError (Join-Path $RuntimeRoot "$($mapping.Name)-pf.err.log") `
        -WindowStyle Hidden `
        -PassThru

    $pids += $process.Id
}

[System.IO.File]::WriteAllLines(
    $PortForwardPidFile,
    ($pids | ForEach-Object { [string]$_ }),
    (New-Object System.Text.UTF8Encoding($false))
)

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "=============================================="
Write-Host "KUBERNETES SMART-METERING STACK STARTED"
Write-Host "=============================================="
Write-Host "Frontend:       http://127.0.0.1:8088"
Write-Host "Backend:        http://127.0.0.1:18080"
Write-Host "MQTT:           mqtt://127.0.0.1:1883"
Write-Host "MQTT ingestion: http://127.0.0.1:18090/health"
Write-Host "Kafka:          127.0.0.1:29092"
Write-Host "Kafka events:   http://127.0.0.1:18100/events"
Write-Host ""
Write-Host "Stop with:"
Write-Host ".\scripts\stop-kubernetes-kind.ps1"
