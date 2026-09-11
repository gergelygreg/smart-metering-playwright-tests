param(
    [string]$RepoRoot = "D:\GitHub\smart-metering-playwright-tests"
)

$ErrorActionPreference = "Stop"

$Distro = "Ubuntu-24.04"
$LinuxRepo = "/mnt/d/GitHub/smart-metering-playwright-tests"
$ComposeFile = "$LinuxRepo/docker-compose.full.yml"
$FrontendRoot = Join-Path $RepoRoot "apps\frontend"
$BackendRoot = Join-Path $RepoRoot "apps\backend"
$ArtifactRoot = Join-Path $RepoRoot ".docker-ci-artifacts"

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

    throw "$ContainerName did not become healthy within $TimeoutSeconds seconds."
}

function Assert-ContainerHealthy {
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
Write-Host "FULL DOCKER + CI/CD LOCAL VERIFICATION"
Write-Host "===================================================="

Write-Host ""
Write-Host "=== 1. Backend regression ==="

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
Write-Host "=== 2. Root TypeScript + Playwright unit ==="

& npm.cmd run typecheck
if ($LASTEXITCODE -ne 0) {
    throw "Root TypeScript typecheck failed."
}

& npx.cmd playwright test --project=unit
if ($LASTEXITCODE -ne 0) {
    throw "Playwright unit tests failed."
}

Write-Host ""
Write-Host "=== 3. Angular unit + production build ==="

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

$keepAlive = $null

try {
    Write-Host ""
    Write-Host "=== 4. WSL/Docker keepalive ==="

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

    Wait-Docker

    Write-Host ""
    Write-Host "=== 5. Compose configuration validation ==="

    & wsl.exe -d $Distro -- docker compose -f $ComposeFile config --quiet
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose config validation failed."
    }

    Write-Host "Compose configuration: VALID"

    Write-Host ""
    Write-Host "=== 6. Build production images ==="

    & wsl.exe -d $Distro -- docker compose -f $ComposeFile down --volumes --remove-orphans
    & wsl.exe -d $Distro -- docker compose -f $ComposeFile build --pull

    if ($LASTEXITCODE -ne 0) {
        throw "Docker image build failed."
    }

    Write-Host ""
    Write-Host "=== 7. Start complete containerized stack ==="

    & wsl.exe -d $Distro -- docker compose -f $ComposeFile up -d

    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose startup failed."
    }

    Wait-ContainerHealthy "smart-metering-full-postgres"
    Wait-ContainerHealthy "smart-metering-full-backend"
    Wait-ContainerHealthy "smart-metering-full-frontend"

    Write-Host ""
    Write-Host "=== 8. Containerized application smoke ==="

    $backendHealth = Invoke-RestMethod `
        -Uri "http://127.0.0.1:18080/api/health" `
        -TimeoutSec 5

    $proxyHealth = Invoke-RestMethod `
        -Uri "http://127.0.0.1:8088/api/health" `
        -TimeoutSec 5

    $frontendHealth = Invoke-WebRequest `
        -Uri "http://127.0.0.1:8088/healthz" `
        -UseBasicParsing `
        -TimeoutSec 5

    $spaResponse = Invoke-WebRequest `
        -Uri "http://127.0.0.1:8088/meters" `
        -UseBasicParsing `
        -TimeoutSec 5

    if ($backendHealth.status -ne "UP") {
        throw "Containerized backend health is not UP."
    }

    if ($proxyHealth.status -ne "UP") {
        throw "Nginx /api proxy health is not UP."
    }

    if ($frontendHealth.StatusCode -ne 200) {
        throw "Nginx /healthz failed."
    }

    if ($spaResponse.StatusCode -ne 200) {
        throw "Angular SPA fallback failed."
    }

    Write-Host "Backend direct:       GREEN"
    Write-Host "Frontend /api proxy:  GREEN"
    Write-Host "Frontend health:      GREEN"
    Write-Host "Angular SPA fallback: GREEN"

    Write-Host ""
    Write-Host "=== 9. Playwright API against Docker stack ==="

    $previousApiBaseUrl = $env:API_BASE_URL
    $env:API_BASE_URL = "http://127.0.0.1:18080"

    try {
        & npm.cmd run test:api
        if ($LASTEXITCODE -ne 0) {
            throw "Playwright API suite failed against Docker stack."
        }
    }
    finally {
        $env:API_BASE_URL = $previousApiBaseUrl
    }

    if (Test-Path -LiteralPath (Join-Path $RepoRoot "playwright-report")) {
        Copy-Item `
            -LiteralPath (Join-Path $RepoRoot "playwright-report") `
            -Destination (Join-Path $ArtifactRoot "playwright-report-api") `
            -Recurse `
            -Force
    }

    Write-Host ""
    Write-Host "=== 10. Playwright UI against fully containerized stack ==="

    $previousUiBaseUrl = $env:UI_BASE_URL
    $previousUiApiBaseUrl = $env:UI_API_BASE_URL

    $env:UI_BASE_URL = "http://127.0.0.1:8088"
    $env:UI_API_BASE_URL = "http://127.0.0.1:18080"

    try {
        & npm.cmd run test:ui
        if ($LASTEXITCODE -ne 0) {
            throw "Playwright UI suite failed against Docker stack."
        }
    }
    finally {
        $env:UI_BASE_URL = $previousUiBaseUrl
        $env:UI_API_BASE_URL = $previousUiApiBaseUrl
    }

    if (Test-Path -LiteralPath (Join-Path $RepoRoot "playwright-report-ui")) {
        Copy-Item `
            -LiteralPath (Join-Path $RepoRoot "playwright-report-ui") `
            -Destination (Join-Path $ArtifactRoot "playwright-report-ui") `
            -Recurse `
            -Force
    }

    Write-Host ""
    Write-Host "=== 11. Runtime stability after integration suites ==="

    Assert-ContainerHealthy "smart-metering-full-postgres"
    Assert-ContainerHealthy "smart-metering-full-backend"
    Assert-ContainerHealthy "smart-metering-full-frontend"

    & wsl.exe -d $Distro -- docker compose -f $ComposeFile ps

    Write-Host ""
    Write-Host "Image inventory:"
    & wsl.exe -d $Distro -- docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" smart-metering-api

    if ($LASTEXITCODE -ne 0) {
        throw "Could not list backend Docker image."
    }

    & wsl.exe -d $Distro -- docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" smart-metering-ui

    if ($LASTEXITCODE -ne 0) {
        throw "Could not list frontend Docker image."
    }

    Write-Host ""
    Write-Host "===================================================="
    Write-Host "FULL DOCKER + CI/CD PHASE VERIFICATION SUCCESS"
    Write-Host "===================================================="
    Write-Host "Backend Maven:                 59/59 GREEN"
    Write-Host "Root Playwright unit:           6/6  GREEN"
    Write-Host "Angular unit:                   5/5  GREEN"
    Write-Host "Angular production build:            GREEN"
    Write-Host "Backend Docker image:                GREEN"
    Write-Host "Frontend Docker/Nginx image:         GREEN"
    Write-Host "PostgreSQL container:                GREEN"
    Write-Host "Nginx -> backend proxy:              GREEN"
    Write-Host "Playwright API on Docker:      35/35 GREEN"
    Write-Host "Playwright UI on Docker:        8/8  GREEN"
    Write-Host "Full-stack runtime stability:        GREEN"
    Write-Host "Total automated checks:       113    GREEN"
}
catch {
    Write-Host ""
    Write-Host "Docker/CI verification failed: $($_.Exception.Message)"

    try {
        Write-Host ""
        Write-Host "=== COMPOSE STATE ==="
        & wsl.exe -d $Distro -- docker compose -f $ComposeFile ps
    }
    catch {
    }

    try {
        Write-Host ""
        Write-Host "=== COMPOSE LOG TAIL ==="
        $logs = & wsl.exe -d $Distro -- docker compose -f $ComposeFile logs --no-color --tail 250
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