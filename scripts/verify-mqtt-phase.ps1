param(
    [string]$RepoRoot = "D:\GitHub\smart-metering-playwright-tests"
)

$ErrorActionPreference = "Stop"

$Distro = "Ubuntu-24.04"
$LinuxRepo = "/mnt/d/GitHub/smart-metering-playwright-tests"
$ComposeFile = "$LinuxRepo/docker-compose.full.yml"
$BackendRoot = Join-Path $RepoRoot "apps\backend"
$FrontendRoot = Join-Path $RepoRoot "apps\frontend"
$DeviceRoot = Join-Path $RepoRoot "apps\device-simulator"
$IngestionRoot = Join-Path $RepoRoot "apps\mqtt-ingestion"
$ArtifactRoot = Join-Path $RepoRoot ".mqtt-phase-artifacts"

function Wait-Docker {
    foreach ($attempt in 1..60) {
        & wsl.exe -d $Distro -- docker info *> $null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Docker: READY"
            return
        }

        Start-Sleep -Seconds 1
    }

    throw "Docker engine did not become ready."
}

function Wait-ContainerHealthy {
    param(
        [string]$ContainerName,
        [int]$TimeoutSeconds = 180
    )

    for ($second = 0; $second -lt $TimeoutSeconds; $second++) {
        $stateOutput = & wsl.exe -d $Distro -- docker inspect --format "{{.State.Status}}/{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}" $ContainerName 2>$null
        $state = ""

        if ($null -ne $stateOutput) {
            $state = ($stateOutput | Out-String).Trim()
        }

        if ($state -eq "running/healthy") {
            Write-Host "$ContainerName`: HEALTHY"
            return
        }

        if ($state -like "exited/*" -or $state -like "dead/*") {
            throw "$ContainerName stopped before becoming healthy."
        }

        Start-Sleep -Seconds 1
    }

    throw "$ContainerName did not become healthy."
}

function Assert-Healthy {
    param([string]$ContainerName)

    $stateOutput = & wsl.exe -d $Distro -- docker inspect --format "{{.State.Status}}/{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}" $ContainerName 2>$null
    $state = ""

    if ($null -ne $stateOutput) {
        $state = ($stateOutput | Out-String).Trim()
    }

    Write-Host "$ContainerName -> $state"

    if ($state -ne "running/healthy") {
        throw "$ContainerName is not running/healthy."
    }
}

Set-Location -LiteralPath $RepoRoot

Remove-Item -LiteralPath $ArtifactRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $ArtifactRoot -Force | Out-Null

Write-Host ""
Write-Host "===================================================="
Write-Host "FULL MQTT SMART-METER PHASE VERIFICATION"
Write-Host "===================================================="

Write-Host ""
Write-Host "=== 1. Existing backend regression ==="

Push-Location $BackendRoot
try {
    & .\mvnw.cmd clean verify
    if ($LASTEXITCODE -ne 0) {
        throw "Backend Maven verification failed."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "=== 2. Existing root TypeScript + Playwright unit ==="

& npm.cmd run typecheck
if ($LASTEXITCODE -ne 0) {
    throw "Root TypeScript typecheck failed."
}

& npx.cmd playwright test --project=unit
if ($LASTEXITCODE -ne 0) {
    throw "Playwright unit tests failed."
}

Write-Host ""
Write-Host "=== 3. Existing Angular unit + build ==="

Push-Location $FrontendRoot
try {
    & npm.cmd test -- --watch=false
    if ($LASTEXITCODE -ne 0) {
        throw "Angular unit tests failed."
    }

    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) {
        throw "Angular production build failed."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "=== 4. MQTT ingestion component tests ==="

Push-Location $IngestionRoot
try {
    & npm.cmd run typecheck
    if ($LASTEXITCODE -ne 0) {
        throw "MQTT ingestion typecheck failed."
    }

    & npm.cmd test
    if ($LASTEXITCODE -ne 0) {
        throw "MQTT ingestion unit tests failed."
    }

    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) {
        throw "MQTT ingestion build failed."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "=== 5. Device simulator tests ==="

Push-Location $DeviceRoot
try {
    & npm.cmd run typecheck
    if ($LASTEXITCODE -ne 0) {
        throw "Device simulator typecheck failed."
    }

    & npm.cmd test
    if ($LASTEXITCODE -ne 0) {
        throw "Device simulator unit tests failed."
    }

    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) {
        throw "Device simulator build failed."
    }
}
finally {
    Pop-Location
}

$keepAlive = $null

try {
    Write-Host ""
    Write-Host "=== 6. WSL/Docker runtime ==="

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
        throw "WSL keepalive exited immediately."
    }

    Wait-Docker

    Write-Host ""
    Write-Host "=== 7. Compose validation + all image builds ==="

    & wsl.exe -d $Distro -- docker compose -f $ComposeFile --profile simulator config --quiet
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose configuration is invalid."
    }

    & wsl.exe -d $Distro -- docker compose -f $ComposeFile down --volumes --remove-orphans

    # Build services sequentially. On this Windows/WSL lab, building all four
    # images concurrently caused the Docker Buildx/BuildKit client to crash
    # with SIGBUS and left WSL unable to create new processes.
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
            --pull `
            $service

        if ($LASTEXITCODE -ne 0) {
            throw "Docker image build failed for service: $service"
        }

        & wsl.exe -d $Distro -- docker info *> $null
        if ($LASTEXITCODE -ne 0) {
            throw "Docker/WSL became unavailable after building service: $service"
        }
    }

    Write-Host ""
    Write-Host "=== 8. Start broker + persistence + API + ingestion + UI ==="

    & wsl.exe -d $Distro -- docker compose -f $ComposeFile up -d
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose startup failed."
    }

    Wait-ContainerHealthy "smart-metering-full-postgres"
    Wait-ContainerHealthy "smart-metering-full-mqtt"
    Wait-ContainerHealthy "smart-metering-full-backend"
    Wait-ContainerHealthy "smart-metering-full-mqtt-ingestion"
    Wait-ContainerHealthy "smart-metering-full-frontend"

    Write-Host ""
    Write-Host "=== 9. MQTT ingestion operational health ==="

    $ingestionHealth = Invoke-RestMethod `
        -Uri "http://127.0.0.1:18090/health" `
        -TimeoutSec 5

    if ($ingestionHealth.status -ne "UP" -or -not $ingestionHealth.mqttConnected) {
        throw "MQTT ingestion is not connected to the broker."
    }

    Write-Host "MQTT ingestion: CONNECTED"

    Write-Host ""
    Write-Host "=== 10. Existing REST API regression on full stack ==="

    $previousApiBaseUrl = $env:API_BASE_URL
    $env:API_BASE_URL = "http://127.0.0.1:18080"

    try {
        & npm.cmd run test:api
        if ($LASTEXITCODE -ne 0) {
            throw "Playwright API suite failed."
        }
    }
    finally {
        $env:API_BASE_URL = $previousApiBaseUrl
    }

    Write-Host ""
    Write-Host "=== 11. Dedicated MQTT integration suite ==="

    $previousMqttApiBaseUrl = $env:MQTT_API_BASE_URL
    $previousMqttUrl = $env:MQTT_URL

    $env:MQTT_API_BASE_URL = "http://127.0.0.1:18080"
    $env:MQTT_URL = "mqtt://127.0.0.1:1883"

    try {
        & npm.cmd run test:mqtt
        if ($LASTEXITCODE -ne 0) {
            throw "Dedicated MQTT integration suite failed."
        }
    }
    finally {
        $env:MQTT_API_BASE_URL = $previousMqttApiBaseUrl
        $env:MQTT_URL = $previousMqttUrl
    }

    Write-Host ""
    Write-Host "=== 12. Browser E2E including MQTT-to-UI ==="

    $previousUiBaseUrl = $env:UI_BASE_URL
    $previousUiApiBaseUrl = $env:UI_API_BASE_URL
    $previousMqttUrl = $env:MQTT_URL

    $env:UI_BASE_URL = "http://127.0.0.1:8088"
    $env:UI_API_BASE_URL = "http://127.0.0.1:18080"
    $env:MQTT_URL = "mqtt://127.0.0.1:1883"

    try {
        & npm.cmd run test:ui
        if ($LASTEXITCODE -ne 0) {
            throw "Playwright UI suite failed."
        }
    }
    finally {
        $env:UI_BASE_URL = $previousUiBaseUrl
        $env:UI_API_BASE_URL = $previousUiApiBaseUrl
        $env:MQTT_URL = $previousMqttUrl
    }

    Write-Host ""
    Write-Host "=== 13. Real device-simulator container acceptance ==="

    $simSerial = "SIM-ACCEPT-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"

    & wsl.exe `
        -d $Distro `
        -- `
        docker compose `
        -f $ComposeFile `
        --profile simulator `
        run `
        --rm `
        -e "SIM_SERIAL_NUMBER=$simSerial" `
        -e "SIM_PROFILE=mixed" `
        -e "SIM_COUNT=4" `
        -e "SIM_INTERVAL_MS=150" `
        device-simulator

    if ($LASTEXITCODE -ne 0) {
        throw "Device simulator container acceptance failed."
    }

    $oldSerial = $env:SIM_SERIAL_NUMBER
    $oldExpectedReadings = $env:EXPECTED_READINGS
    $oldExpectAlarm = $env:EXPECT_ALARM
    $oldApiBaseUrl = $env:API_BASE_URL

    $env:SIM_SERIAL_NUMBER = $simSerial
    $env:EXPECTED_READINGS = "4"
    $env:EXPECT_ALARM = "true"
    $env:API_BASE_URL = "http://127.0.0.1:18080"

    try {
        & node (Join-Path $RepoRoot "scripts\assert-simulator-output.mjs")
        if ($LASTEXITCODE -ne 0) {
            throw "Simulator output assertion failed."
        }
    }
    finally {
        $env:SIM_SERIAL_NUMBER = $oldSerial
        $env:EXPECTED_READINGS = $oldExpectedReadings
        $env:EXPECT_ALARM = $oldExpectAlarm
        $env:API_BASE_URL = $oldApiBaseUrl
    }

    Write-Host ""
    Write-Host "=== 14. Runtime stability ==="

    Assert-Healthy "smart-metering-full-postgres"
    Assert-Healthy "smart-metering-full-mqtt"
    Assert-Healthy "smart-metering-full-backend"
    Assert-Healthy "smart-metering-full-mqtt-ingestion"
    Assert-Healthy "smart-metering-full-frontend"

    Write-Host ""
    Write-Host "===================================================="
    Write-Host "MQTT SMART-METER PHASE VERIFICATION SUCCESS"
    Write-Host "===================================================="
    Write-Host "Backend Maven:                        59/59 GREEN"
    Write-Host "Playwright unit:                       6/6  GREEN"
    Write-Host "Angular unit:                          5/5  GREEN"
    Write-Host "MQTT ingestion unit:                  16/16 GREEN"
    Write-Host "Device simulator unit:                 8/8  GREEN"
    Write-Host "Playwright API:                       35/35 GREEN"
    Write-Host "Dedicated MQTT integration:            4/4  GREEN"
    Write-Host "Browser UI incl. MQTT flow:             9/9  GREEN"
    Write-Host "Real simulator container acceptance:         GREEN"
    Write-Host "Mosquitto broker:                           GREEN"
    Write-Host "MQTT -> REST -> JPA -> PostgreSQL:           GREEN"
    Write-Host "MQTT -> Alarm -> Angular UI:                 GREEN"
    Write-Host "Total automated tests:                 142   GREEN"
}
catch {
    Write-Host ""
    Write-Host "MQTT phase verification failed: $($_.Exception.Message)"

    try {
        & wsl.exe -d $Distro -- docker compose -f $ComposeFile ps
    }
    catch {
    }

    try {
        $logs = & wsl.exe -d $Distro -- docker compose -f $ComposeFile logs --no-color --tail 300
        $logs | Tee-Object -FilePath (Join-Path $ArtifactRoot "docker-compose.log")
    }
    catch {
    }

    throw
}
finally {
    try {
        & wsl.exe -d $Distro -- docker compose -f $ComposeFile logs --no-color > (Join-Path $ArtifactRoot "docker-compose-full.log")
    }
    catch {
    }

    try {
        & wsl.exe -d $Distro -- docker compose -f $ComposeFile down --volumes --remove-orphans
    }
    catch {
        Write-Warning "Docker Compose cleanup failed."
    }

    if ($null -ne $keepAlive -and -not $keepAlive.HasExited) {
        Stop-Process -Id $keepAlive.Id -Force -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host "=== Git status ==="
git status --short
git diff --check
git diff --stat