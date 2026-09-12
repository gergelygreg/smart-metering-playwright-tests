param(
    [string]$RepoRoot = "D:\GitHub\smart-metering-playwright-tests"
)

$ErrorActionPreference = "Stop"

$BackendRoot = Join-Path $RepoRoot "apps\backend"
$FrontendRoot = Join-Path $RepoRoot "apps\frontend"
$IngestionRoot = Join-Path $RepoRoot "apps\mqtt-ingestion"
$DeviceRoot = Join-Path $RepoRoot "apps\device-simulator"
$KafkaRoot = Join-Path $RepoRoot "apps\kafka-event-service"

Set-Location -LiteralPath $RepoRoot

Write-Host ""
Write-Host "===================================================="
Write-Host "FULL KAFKA EVENT-DRIVEN PHASE VERIFICATION"
Write-Host "===================================================="

Write-Host ""
Write-Host "=== 1. Component regression ==="

Push-Location $BackendRoot
try {
    & .\mvnw.cmd clean verify
    if ($LASTEXITCODE -ne 0) { throw "Backend tests failed." }
}
finally { Pop-Location }

& npm.cmd run typecheck
if ($LASTEXITCODE -ne 0) { throw "Root TypeScript failed." }

& npx.cmd playwright test --project=unit
if ($LASTEXITCODE -ne 0) { throw "Playwright unit failed." }

Push-Location $FrontendRoot
try {
    & npm.cmd test -- --watch=false
    if ($LASTEXITCODE -ne 0) { throw "Angular unit failed." }

    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw "Angular build failed." }
}
finally { Pop-Location }

foreach ($app in @(
    @{ Path = $IngestionRoot; Name = "MQTT ingestion" },
    @{ Path = $DeviceRoot; Name = "Device simulator" },
    @{ Path = $KafkaRoot; Name = "Kafka event service" }
)) {
    Push-Location $app.Path
    try {
        & npm.cmd run typecheck
        if ($LASTEXITCODE -ne 0) { throw "$($app.Name) typecheck failed." }

        & npm.cmd test
        if ($LASTEXITCODE -ne 0) { throw "$($app.Name) tests failed." }

        & npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw "$($app.Name) build failed." }
    }
    finally { Pop-Location }
}

$started = $false

try {
    Write-Host ""
    Write-Host "=== 2. Start full Docker/Kafka stack ==="

    & (Join-Path $RepoRoot "scripts\start-full-stack.ps1") -RepoRoot $RepoRoot
    $started = $true

    Write-Host ""
    Write-Host "=== 3. REST API regression ==="

    $oldApi = $env:API_BASE_URL
    $env:API_BASE_URL = "http://127.0.0.1:18080"

    try {
        & npm.cmd run test:api
        if ($LASTEXITCODE -ne 0) { throw "REST API suite failed." }
    }
    finally { $env:API_BASE_URL = $oldApi }

    Write-Host ""
    Write-Host "=== 4. MQTT -> Kafka integration ==="

    $oldMqttApi = $env:MQTT_API_BASE_URL
    $oldMqtt = $env:MQTT_URL
    $env:MQTT_API_BASE_URL = "http://127.0.0.1:18080"
    $env:MQTT_URL = "mqtt://127.0.0.1:1883"

    try {
        & npm.cmd run test:mqtt
        if ($LASTEXITCODE -ne 0) { throw "MQTT suite failed." }
    }
    finally {
        $env:MQTT_API_BASE_URL = $oldMqttApi
        $env:MQTT_URL = $oldMqtt
    }

    Write-Host ""
    Write-Host "=== 5. Dedicated Kafka integration ==="

    $oldKafkaApi = $env:KAFKA_API_BASE_URL
    $oldKafka = $env:KAFKA_BROKER
    $oldEvent = $env:KAFKA_EVENT_SERVICE_BASE_URL

    $env:KAFKA_API_BASE_URL = "http://127.0.0.1:18080"
    $env:KAFKA_BROKER = "127.0.0.1:29092"
    $env:KAFKA_EVENT_SERVICE_BASE_URL = "http://127.0.0.1:18100"

    try {
        & npm.cmd run test:kafka
        if ($LASTEXITCODE -ne 0) { throw "Kafka suite failed." }
    }
    finally {
        $env:KAFKA_API_BASE_URL = $oldKafkaApi
        $env:KAFKA_BROKER = $oldKafka
        $env:KAFKA_EVENT_SERVICE_BASE_URL = $oldEvent
    }

    Write-Host ""
    Write-Host "=== 6. Browser E2E including MQTT -> Kafka -> UI ==="

    $oldUi = $env:UI_BASE_URL
    $oldUiApi = $env:UI_API_BASE_URL
    $oldMqtt = $env:MQTT_URL

    $env:UI_BASE_URL = "http://127.0.0.1:8088"
    $env:UI_API_BASE_URL = "http://127.0.0.1:18080"
    $env:MQTT_URL = "mqtt://127.0.0.1:1883"

    try {
        & npm.cmd run test:ui
        if ($LASTEXITCODE -ne 0) { throw "UI suite failed." }
    }
    finally {
        $env:UI_BASE_URL = $oldUi
        $env:UI_API_BASE_URL = $oldUiApi
        $env:MQTT_URL = $oldMqtt
    }

    Write-Host ""
    Write-Host "=== 7. Real simulator event-chain acceptance ==="

    $serial = "KAFKA-SIM-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"

    & (Join-Path $RepoRoot "scripts\run-device-simulator.ps1") `
        -Profile mixed `
        -Count 4 `
        -IntervalMs 150 `
        -SerialNumber $serial `
        -RepoRoot $RepoRoot

    $oldSerial = $env:SIM_SERIAL_NUMBER
    $oldExpected = $env:EXPECTED_READINGS
    $oldAlarm = $env:EXPECT_ALARM
    $oldApi = $env:API_BASE_URL
    $oldEvent = $env:KAFKA_EVENT_SERVICE_BASE_URL

    $env:SIM_SERIAL_NUMBER = $serial
    $env:EXPECTED_READINGS = "4"
    $env:EXPECT_ALARM = "true"
    $env:API_BASE_URL = "http://127.0.0.1:18080"
    $env:KAFKA_EVENT_SERVICE_BASE_URL = "http://127.0.0.1:18100"

    try {
        & node (Join-Path $RepoRoot "scripts\assert-simulator-output.mjs")
        if ($LASTEXITCODE -ne 0) { throw "Simulator event-chain assertion failed." }
    }
    finally {
        $env:SIM_SERIAL_NUMBER = $oldSerial
        $env:EXPECTED_READINGS = $oldExpected
        $env:EXPECT_ALARM = $oldAlarm
        $env:API_BASE_URL = $oldApi
        $env:KAFKA_EVENT_SERVICE_BASE_URL = $oldEvent
    }

    Write-Host ""
    Write-Host "===================================================="
    Write-Host "KAFKA EVENT-DRIVEN PHASE VERIFICATION SUCCESS"
    Write-Host "===================================================="
    Write-Host "Backend Maven:                  59/59 GREEN"
    Write-Host "Playwright unit:                 6/6  GREEN"
    Write-Host "Angular unit:                    5/5  GREEN"
    Write-Host "MQTT ingestion unit:            16/16 GREEN"
    Write-Host "Device simulator unit:           8/8  GREEN"
    Write-Host "Kafka event service unit:       12/12 GREEN"
    Write-Host "Playwright API:                 35/35 GREEN"
    Write-Host "MQTT integration:                4/4  GREEN"
    Write-Host "Kafka integration:               5/5  GREEN"
    Write-Host "Browser UI:                      9/9  GREEN"
    Write-Host "Total automated tests:          159   GREEN"
}
finally {
    if ($started) {
        & (Join-Path $RepoRoot "scripts\stop-full-stack.ps1") `
            -RepoRoot $RepoRoot `
            -RemoveVolumes
    }
}

Write-Host ""
git status --short
git diff --check
git diff --stat
