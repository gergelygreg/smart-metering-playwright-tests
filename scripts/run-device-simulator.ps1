param(
    [ValidateSet("normal", "high-voltage", "mixed")]
    [string]$Profile = "mixed",

    [int]$Count = 4,

    [int]$IntervalMs = 250,

    [string]$SerialNumber = "",

    [string]$RepoRoot = "D:\GitHub\smart-metering-playwright-tests"
)

$ErrorActionPreference = "Stop"

if ($Count -le 0) {
    throw "Count must be greater than zero."
}

if ($IntervalMs -le 0) {
    throw "IntervalMs must be greater than zero."
}

if ([string]::IsNullOrWhiteSpace($SerialNumber)) {
    $SerialNumber = "SIM-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
}

$Distro = "Ubuntu-24.04"
$LinuxRepo = "/mnt/d/GitHub/smart-metering-playwright-tests"
$ComposeFile = "$LinuxRepo/docker-compose.full.yml"

Set-Location -LiteralPath $RepoRoot

$requiredContainers = @(
    "smart-metering-full-postgres",
    "smart-metering-full-mqtt",
    "smart-metering-full-backend",
    "smart-metering-full-mqtt-ingestion"
)

foreach ($container in $requiredContainers) {
    $statusOutput = & wsl.exe -d $Distro -- docker inspect --format "{{.State.Status}}" $container 2>$null
    $status = ""

    if ($null -ne $statusOutput) {
        $status = ($statusOutput | Out-String).Trim()
    }

    if ($status -ne "running") {
        throw "$container is not running. Start the full stack first."
    }
}

Write-Host ""
Write-Host "Running smart-meter simulator:"
Write-Host "  Serial:   $SerialNumber"
Write-Host "  Profile:  $Profile"
Write-Host "  Count:    $Count"
Write-Host "  Interval: $IntervalMs ms"
Write-Host ""

& wsl.exe `
    -d $Distro `
    -- `
    docker compose `
    -f $ComposeFile `
    --profile simulator `
    run `
    --rm `
    -e "SIM_SERIAL_NUMBER=$SerialNumber" `
    -e "SIM_PROFILE=$Profile" `
    -e "SIM_COUNT=$Count" `
    -e "SIM_INTERVAL_MS=$IntervalMs" `
    device-simulator

if ($LASTEXITCODE -ne 0) {
    throw "Device simulator container failed."
}

Write-Host ""
Write-Host "Simulator run completed."
Write-Host "Serial number: $SerialNumber"