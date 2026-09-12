param(
    [string]$RepoRoot = "D:\GitHub\smart-metering-playwright-tests",
    [switch]$NoBuild
)

$ErrorActionPreference = "Stop"

$Distro = "Ubuntu-24.04"
$LinuxRepo = "/mnt/d/GitHub/smart-metering-playwright-tests"
$ComposeFile = "$LinuxRepo/docker-compose.full.yml"
$RuntimeRoot = Join-Path $RepoRoot ".docker-runtime"
$PidFile = Join-Path $RuntimeRoot "wsl-keepalive.pid"

function Wait-Docker {
    foreach ($attempt in 1..60) {
        & wsl.exe -d $Distro -- docker info *> $null
        if ($LASTEXITCODE -eq 0) {
            return
        }
        Start-Sleep -Seconds 1
    }

    throw "Docker engine did not become ready."
}

function Wait-Healthy {
    param(
        [string]$Container,
        [int]$TimeoutSeconds = 240
    )

    for ($i = 0; $i -lt $TimeoutSeconds; $i++) {
        $output = & wsl.exe -d $Distro -- docker inspect --format "{{.State.Status}}/{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}" $Container 2>$null
        $state = if ($null -eq $output) { "" } else { ($output | Out-String).Trim() }

        Write-Host "$Container -> $state"

        if ($state -eq "running/healthy") {
            return
        }

        if ($state -like "exited/*" -or $state -like "dead/*") {
            throw "$Container stopped before becoming healthy."
        }

        Start-Sleep -Seconds 1
    }

    throw "$Container did not become healthy."
}

Set-Location -LiteralPath $RepoRoot
New-Item -ItemType Directory -Path $RuntimeRoot -Force | Out-Null

$keepAlive = $null

try {
    if (Test-Path -LiteralPath $PidFile) {
        $pidValue = 0
        [void][int]::TryParse(
            ([System.IO.File]::ReadAllText($PidFile)).Trim(),
            [ref]$pidValue
        )

        if ($pidValue -le 0 -or -not (Get-Process -Id $pidValue -ErrorAction SilentlyContinue)) {
            Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
        }
    }

    if (-not (Test-Path -LiteralPath $PidFile)) {
        $keepAlive = Start-Process `
            -FilePath "wsl.exe" `
            -ArgumentList @("-d", $Distro, "--", "sleep", "infinity") `
            -WindowStyle Hidden `
            -PassThru

        Start-Sleep -Seconds 2

        if ($keepAlive.HasExited) {
            throw "WSL keepalive exited immediately."
        }

        [System.IO.File]::WriteAllText(
            $PidFile,
            [string]$keepAlive.Id,
            (New-Object System.Text.UTF8Encoding($false))
        )
    }

    Wait-Docker

    if (-not $NoBuild) {
        foreach ($service in @(
            "backend",
            "frontend",
            "mqtt-ingestion",
            "kafka-event-service",
            "device-simulator"
        )) {
            Write-Host "Building Docker service: $service"

            & wsl.exe `
                -d $Distro `
                -- `
                docker compose `
                -f $ComposeFile `
                --profile simulator `
                build `
                $service

            if ($LASTEXITCODE -ne 0) {
                throw "Docker build failed for service: $service"
            }

            & wsl.exe -d $Distro -- docker info *> $null
            if ($LASTEXITCODE -ne 0) {
                throw "Docker/WSL became unavailable after building $service."
            }
        }
    }

    & wsl.exe -d $Distro -- docker compose -f $ComposeFile up -d
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose up failed."
    }

    foreach ($container in @(
        "smart-metering-full-postgres",
        "smart-metering-full-mqtt",
        "smart-metering-full-kafka",
        "smart-metering-full-backend",
        "smart-metering-full-mqtt-ingestion",
        "smart-metering-full-kafka-event-service",
        "smart-metering-full-frontend"
    )) {
        Wait-Healthy $container
    }

    $backend = Invoke-RestMethod -Uri "http://127.0.0.1:18080/api/health" -TimeoutSec 5
    $ingestion = Invoke-RestMethod -Uri "http://127.0.0.1:18090/health" -TimeoutSec 5
    $eventService = Invoke-RestMethod -Uri "http://127.0.0.1:18100/health" -TimeoutSec 5

    if ($backend.status -ne "UP") {
        throw "Backend health is not UP."
    }

    if (
        $ingestion.status -ne "UP" -or
        -not $ingestion.mqttConnected -or
        -not $ingestion.kafkaConnected
    ) {
        throw "MQTT ingestion is not connected to both MQTT and Kafka."
    }

    if ($eventService.status -ne "UP") {
        throw "Kafka event service health is not UP."
    }

    Write-Host ""
    Write-Host "============================================"
    Write-Host "EVENT-DRIVEN SMART METERING STACK IS READY"
    Write-Host "============================================"
    Write-Host "Frontend:       http://127.0.0.1:8088"
    Write-Host "Backend:        http://127.0.0.1:18080"
    Write-Host "MQTT:           mqtt://127.0.0.1:1883"
    Write-Host "MQTT ingestion: http://127.0.0.1:18090/health"
    Write-Host "Kafka:          127.0.0.1:29092"
    Write-Host "Kafka events:   http://127.0.0.1:18100/events"
}
catch {
    try {
        & wsl.exe -d $Distro -- docker compose -f $ComposeFile logs --no-color --tail 250
    }
    catch {
    }

    if ($null -ne $keepAlive -and -not $keepAlive.HasExited) {
        Stop-Process -Id $keepAlive.Id -Force -ErrorAction SilentlyContinue
    }

    Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
    throw
}
