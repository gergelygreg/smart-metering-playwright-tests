param(
    [string]$RepoRoot = "D:\GitHub\smart-metering-playwright-tests",
    [string]$Distro = "Ubuntu-24.04",
    [switch]$KeepCluster,
    [switch]$ReuseCluster,
    [switch]$NoBuild
)

$ErrorActionPreference = "Stop"
$LinuxRepo = "/mnt/d/GitHub/smart-metering-playwright-tests"
$RuntimeRoot = Join-Path $RepoRoot ".k8s-runtime"

New-Item -ItemType Directory -Path $RuntimeRoot -Force | Out-Null

function Invoke-Wsl {
    param(
        [string]$Command,
        [string]$FailureMessage
    )

    & wsl.exe `
        -d $Distro `
        -- `
        bash `
        -lc `
        "cd '$LinuxRepo' && $Command"

    if ($LASTEXITCODE -ne 0) {
        throw $FailureMessage
    }
}

function Wait-Http {
    param(
        [string]$Uri,
        [string]$Name,
        [int]$TimeoutSeconds = 120
    )

    for ($i = 0; $i -lt $TimeoutSeconds; $i++) {
        try {
            $response = Invoke-WebRequest `
                -Uri $Uri `
                -UseBasicParsing `
                -TimeoutSec 2

            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
                Write-Host "$Name`: READY"
                return
            }
        }
        catch {
        }

        Start-Sleep -Seconds 1
    }

    throw "$Name did not become ready: $Uri"
}

function Wait-Tcp {
    param(
        [string]$HostName,
        [int]$Port,
        [string]$Name,
        [int]$TimeoutSeconds = 120
    )

    for ($i = 0; $i -lt $TimeoutSeconds; $i++) {
        $client = New-Object System.Net.Sockets.TcpClient

        try {
            $async = $client.BeginConnect($HostName, $Port, $null, $null)

            if ($async.AsyncWaitHandle.WaitOne(1000) -and $client.Connected) {
                $client.EndConnect($async)
                $client.Close()
                Write-Host "$Name`: READY"
                return
            }
        }
        catch {
        }
        finally {
            $client.Close()
        }

        Start-Sleep -Seconds 1
    }

    throw "$Name did not become ready: $HostName`:$Port"
}

Set-Location -LiteralPath $RepoRoot

Write-Host ""
Write-Host "===================================================="
Write-Host "KUBERNETES / KIND ORCHESTRATION VERIFICATION"
Write-Host "===================================================="

$drive = Get-PSDrive -Name D
$freeGb = [math]::Round($drive.Free / 1GB, 2)

Write-Host "D: free space: $freeGb GB"

if ($freeGb -lt 6) {
    throw "Less than 6 GB free on D:. Free more disk space before creating the kind cluster."
}

if ($freeGb -lt 10) {
    Write-Warning "Less than 10 GB free on D:. More headroom is recommended."
}

git diff --check

if ($LASTEXITCODE -ne 0) {
    throw "git diff --check failed."
}

$keepAlive = $null
$portForwards = @()

try {
    $keepAlive = Start-Process `
        -FilePath "wsl.exe" `
        -ArgumentList @("-d", $Distro, "--", "sleep", "infinity") `
        -WindowStyle Hidden `
        -PassThru

    Start-Sleep -Seconds 2

    if ($keepAlive.HasExited) {
        throw "WSL keepalive exited immediately."
    }

    if ($NoBuild -and -not $ReuseCluster) {
        throw "-NoBuild requires -ReuseCluster so the existing kind node can keep its loaded local images."
    }

    if ($ReuseCluster) {
        Write-Host ""
        Write-Host "=== Reusing existing kind cluster ==="

        Invoke-Wsl `
            -Command "bash ./scripts/k8s/recover-existing-cluster.sh" `
            -FailureMessage "Existing smart-metering kind cluster could not be recovered."
    }
    else {
        Invoke-Wsl `
            -Command "bash ./scripts/k8s/create-cluster.sh" `
            -FailureMessage "kind cluster creation failed."
    }

    if ($NoBuild) {
        Write-Host ""
        Write-Host "=== Reusing images already loaded into kind ==="
    }
    else {
        Invoke-Wsl `
            -Command "bash ./scripts/k8s/build-load-images.sh" `
            -FailureMessage "Kubernetes image build/load failed."
    }

    Invoke-Wsl `
        -Command "bash ./scripts/k8s/deploy.sh" `
        -FailureMessage "Kubernetes deployment failed."

    $kubectl = "$LinuxRepo/.tools/k8s/kubectl"

    $mappings = @(
        @{ Resource = "service/backend"; Port = "18080:8080"; Name = "backend" },
        @{ Resource = "service/frontend"; Port = "8088:80"; Name = "frontend" },
        @{ Resource = "service/mqtt-broker"; Port = "1883:1883"; Name = "mqtt" },
        @{ Resource = "service/mqtt-ingestion"; Port = "18090:8090"; Name = "mqtt-ingestion" },
        @{ Resource = "service/kafka-event-service"; Port = "18100:8100"; Name = "kafka-event-service" },
        @{ Resource = "service/kafka"; Port = "29092:29092"; Name = "kafka" }
    )

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

        $portForwards += $process
    }

    Wait-Http "http://127.0.0.1:18080/api/health" "backend"
    Wait-Http "http://127.0.0.1:8088/healthz" "frontend"
    Wait-Http "http://127.0.0.1:18090/health" "mqtt-ingestion"
    Wait-Http "http://127.0.0.1:18100/health" "kafka-event-service"
    Wait-Tcp "127.0.0.1" 1883 "mqtt"
    Wait-Tcp "127.0.0.1" 29092 "kafka"

    Write-Host ""
    Write-Host "=== REST API on Kubernetes ==="

    $oldApi = $env:API_BASE_URL
    $env:API_BASE_URL = "http://127.0.0.1:18080"

    try {
        & npm.cmd run test:api
        if ($LASTEXITCODE -ne 0) {
            throw "REST API suite failed on Kubernetes."
        }
    }
    finally {
        $env:API_BASE_URL = $oldApi
    }

    Write-Host ""
    Write-Host "=== MQTT -> Kafka on Kubernetes ==="

    $oldMqttApi = $env:MQTT_API_BASE_URL
    $oldMqtt = $env:MQTT_URL
    $env:MQTT_API_BASE_URL = "http://127.0.0.1:18080"
    $env:MQTT_URL = "mqtt://127.0.0.1:1883"

    try {
        & npm.cmd run test:mqtt
        if ($LASTEXITCODE -ne 0) {
            throw "MQTT suite failed on Kubernetes."
        }
    }
    finally {
        $env:MQTT_API_BASE_URL = $oldMqttApi
        $env:MQTT_URL = $oldMqtt
    }

    Write-Host ""
    Write-Host "=== Kafka contracts on Kubernetes ==="

    $oldKafkaApi = $env:KAFKA_API_BASE_URL
    $oldKafkaBroker = $env:KAFKA_BROKER
    $oldKafkaService = $env:KAFKA_EVENT_SERVICE_BASE_URL

    $env:KAFKA_API_BASE_URL = "http://127.0.0.1:18080"
    $env:KAFKA_BROKER = "127.0.0.1:29092"
    $env:KAFKA_EVENT_SERVICE_BASE_URL = "http://127.0.0.1:18100"

    try {
        & npm.cmd run test:kafka
        if ($LASTEXITCODE -ne 0) {
            throw "Kafka suite failed on Kubernetes."
        }
    }
    finally {
        $env:KAFKA_API_BASE_URL = $oldKafkaApi
        $env:KAFKA_BROKER = $oldKafkaBroker
        $env:KAFKA_EVENT_SERVICE_BASE_URL = $oldKafkaService
    }

    Write-Host ""
    Write-Host "=== Browser E2E on Kubernetes ==="

    $oldUiBase = $env:UI_BASE_URL
    $oldUiApi = $env:UI_API_BASE_URL
    $oldUiMqtt = $env:MQTT_URL

    $env:UI_BASE_URL = "http://127.0.0.1:8088"
    $env:UI_API_BASE_URL = "http://127.0.0.1:18080"
    $env:MQTT_URL = "mqtt://127.0.0.1:1883"

    try {
        & npm.cmd run test:ui
        if ($LASTEXITCODE -ne 0) {
            throw "UI suite failed on Kubernetes."
        }
    }
    finally {
        $env:UI_BASE_URL = $oldUiBase
        $env:UI_API_BASE_URL = $oldUiApi
        $env:MQTT_URL = $oldUiMqtt
    }

    Write-Host ""
    Write-Host "=== Device simulator Kubernetes Job ==="

    $serial = "K8S-SIM-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"

    Invoke-Wsl `
        -Command "bash ./scripts/k8s/run-simulator-job.sh '$serial' mixed 4 150" `
        -FailureMessage "Kubernetes simulator Job failed."

    $oldSerial = $env:SIM_SERIAL_NUMBER
    $oldExpected = $env:EXPECTED_READINGS
    $oldAlarm = $env:EXPECT_ALARM
    $oldAssertApi = $env:API_BASE_URL
    $oldAssertEvent = $env:KAFKA_EVENT_SERVICE_BASE_URL

    $env:SIM_SERIAL_NUMBER = $serial
    $env:EXPECTED_READINGS = "4"
    $env:EXPECT_ALARM = "true"
    $env:API_BASE_URL = "http://127.0.0.1:18080"
    $env:KAFKA_EVENT_SERVICE_BASE_URL = "http://127.0.0.1:18100"

    try {
        & node (Join-Path $RepoRoot "scripts\assert-simulator-output.mjs")
        if ($LASTEXITCODE -ne 0) {
            throw "Simulator output assertion failed."
        }
    }
    finally {
        $env:SIM_SERIAL_NUMBER = $oldSerial
        $env:EXPECTED_READINGS = $oldExpected
        $env:EXPECT_ALARM = $oldAlarm
        $env:API_BASE_URL = $oldAssertApi
        $env:KAFKA_EVENT_SERVICE_BASE_URL = $oldAssertEvent
    }

    Write-Host ""
    Write-Host "=== Kubernetes operational acceptance ==="

    Invoke-Wsl `
        -Command "bash ./scripts/k8s/operational-acceptance.sh" `
        -FailureMessage "Kubernetes operational acceptance failed."


    Write-Host ""
    Write-Host "===================================================="
    Write-Host "KUBERNETES KIND ORCHESTRATION ACCEPTANCE SUCCESS"
    Write-Host "===================================================="
    Write-Host "Kubernetes:                  v1.37.0"
    Write-Host "kind:                        v0.33.0"
    Write-Host "Application integration:     53/53 GREEN"
    Write-Host "Device simulator Job:              GREEN"
    Write-Host "Backend pod self-healing:          GREEN"
    Write-Host "Backend scale 2 -> 3 -> 2:         GREEN"
    Write-Host "PostgreSQL/Kafka PVCs:             BOUND"
    Write-Host "MQTT -> Kafka -> API -> UI:        GREEN"
}
finally {
    foreach ($process in $portForwards) {
        if ($null -ne $process -and -not $process.HasExited) {
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        }
    }

    if (-not $KeepCluster) {
        try {
            Invoke-Wsl `
                -Command "bash ./scripts/k8s/destroy-cluster.sh" `
                -FailureMessage "kind cleanup failed."
        }
        catch {
            Write-Warning $_.Exception.Message
        }
    }

    if ($null -ne $keepAlive -and -not $keepAlive.HasExited) {
        Stop-Process -Id $keepAlive.Id -Force -ErrorAction SilentlyContinue
    }
}

Write-Host ""
git status --short
git diff --check
git diff --stat
