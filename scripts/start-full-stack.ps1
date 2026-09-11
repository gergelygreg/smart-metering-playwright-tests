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

function Wait-ContainerHealthy {
    param(
        [string]$ContainerName,
        [int]$TimeoutSeconds = 150
    )

    for ($second = 0; $second -lt $TimeoutSeconds; $second++) {
        $stateOutput = & wsl.exe -d $Distro -- docker inspect --format "{{.State.Status}}/{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}" $ContainerName 2>$null
        $state = ""

        if ($null -ne $stateOutput) {
            $state = ($stateOutput | Out-String).Trim()
        }

        Write-Host "$ContainerName -> $state"

        if ($state -eq "running/healthy") {
            return
        }

        if ($state -like "exited/*" -or $state -like "dead/*") {
            throw "$ContainerName stopped before becoming healthy."
        }

        Start-Sleep -Seconds 1
    }

    throw "$ContainerName did not become healthy."
}

Set-Location -LiteralPath $RepoRoot
New-Item -ItemType Directory -Path $RuntimeRoot -Force | Out-Null

$keepAlive = $null

try {
    if (Test-Path -LiteralPath $PidFile) {
        $existingPid = 0
        [void][int]::TryParse(
            ([System.IO.File]::ReadAllText($PidFile)).Trim(),
            [ref]$existingPid
        )

        if ($existingPid -gt 0 -and (Get-Process -Id $existingPid -ErrorAction SilentlyContinue)) {
            Write-Host "Existing WSL keepalive PID: $existingPid"
        }
        else {
            Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
        }
    }

    if (-not (Test-Path -LiteralPath $PidFile)) {
        $keepAlive = Start-Process `
            -FilePath "wsl.exe" `
            -ArgumentList @(
                "-d",
                $Distro,
                "--",
                "sleep",
                "infinity"
            ) `
            -WindowStyle Hidden `
            -PassThru

        Start-Sleep -Seconds 2

        if ($keepAlive.HasExited) {
            throw "WSL keepalive exited immediately. ExitCode=$($keepAlive.ExitCode)"
        }

        [System.IO.File]::WriteAllText(
            $PidFile,
            [string]$keepAlive.Id,
            (New-Object System.Text.UTF8Encoding($false))
        )

        Write-Host "WSL keepalive PID: $($keepAlive.Id)"
    }

    Wait-Docker

    $composeArgs = @(
        "-d",
        $Distro,
        "--",
        "docker",
        "compose",
        "-f",
        $ComposeFile
    )

    if (-not $NoBuild) {
        $buildServices = @(
            "backend",
            "frontend",
            "mqtt-ingestion",
            "device-simulator"
        )

        foreach ($service in $buildServices) {
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
                throw "docker compose build failed for service: $service"
            }

            & wsl.exe -d $Distro -- docker info *> $null
            if ($LASTEXITCODE -ne 0) {
                throw "Docker/WSL became unavailable after building service: $service"
            }
        }
    }

    & wsl.exe @composeArgs up -d

    if ($LASTEXITCODE -ne 0) {
        throw "docker compose up failed."
    }

    Wait-ContainerHealthy "smart-metering-full-postgres"
    Wait-ContainerHealthy "smart-metering-full-mqtt"
    Wait-ContainerHealthy "smart-metering-full-backend"
    Wait-ContainerHealthy "smart-metering-full-mqtt-ingestion"
    Wait-ContainerHealthy "smart-metering-full-frontend"

    $backend = Invoke-RestMethod -Uri "http://127.0.0.1:18080/api/health" -TimeoutSec 5
    $proxy = Invoke-RestMethod -Uri "http://127.0.0.1:8088/api/health" -TimeoutSec 5
    $frontendHealth = Invoke-WebRequest -Uri "http://127.0.0.1:8088/healthz" -UseBasicParsing -TimeoutSec 5
    $mqttIngestion = Invoke-RestMethod -Uri "http://127.0.0.1:18090/health" -TimeoutSec 5

    if ($backend.status -ne "UP") {
        throw "Backend health is not UP."
    }

    if ($proxy.status -ne "UP") {
        throw "Frontend /api reverse proxy is not UP."
    }

    if ($frontendHealth.StatusCode -ne 200) {
        throw "Frontend health endpoint failed."
    }

    if ($mqttIngestion.status -ne "UP" -or -not $mqttIngestion.mqttConnected) {
        throw "MQTT ingestion health is not UP."
    }

    Write-Host ""
    Write-Host "================================================"
    Write-Host "SMART METERING MQTT DOCKER STACK IS READY"
    Write-Host "================================================"
    Write-Host "Frontend:        http://127.0.0.1:8088"
    Write-Host "Backend:         http://127.0.0.1:18080"
    Write-Host "MQTT broker:     mqtt://127.0.0.1:1883"
    Write-Host "MQTT ingestion:  http://127.0.0.1:18090/health"
    Write-Host "PostgreSQL:      127.0.0.1:15432"
    Write-Host ""
    Write-Host "Run simulator:"
    Write-Host ".\scripts\run-device-simulator.ps1 -Profile mixed -Count 4"
    Write-Host ""
    Write-Host "Stop:"
    Write-Host ".\scripts\stop-full-stack.ps1"
}
catch {
    Write-Host ""
    Write-Host "Startup failed: $($_.Exception.Message)"

    try {
        & wsl.exe -d $Distro -- docker compose -f $ComposeFile logs --no-color --tail 180
    }
    catch {
    }

    if ($null -ne $keepAlive -and -not $keepAlive.HasExited) {
        Stop-Process -Id $keepAlive.Id -Force -ErrorAction SilentlyContinue
    }

    Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
    throw
}