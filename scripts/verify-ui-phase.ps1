param(
    [string]$RepoRoot = "D:\GitHub\smart-metering-playwright-tests"
)

$ErrorActionPreference = "Stop"

$Distro = "Ubuntu-24.04"
$LinuxRepo = "/mnt/d/GitHub/smart-metering-playwright-tests"
$ComposeFile = "$LinuxRepo/docker-compose.persistence.yml"
$BackendRoot = Join-Path $RepoRoot "apps\backend"
$FrontendRoot = Join-Path $RepoRoot "apps\frontend"
$Jar = Join-Path $BackendRoot "target\smart-metering-api-0.0.1-SNAPSHOT.jar"
$BackendPort = 18080
$FrontendPort = 4200
$BackendUrl = "http://127.0.0.1:$BackendPort"
$FrontendUrl = "http://127.0.0.1:$FrontendPort"
$LogRoot = Join-Path $RepoRoot ".ui-phase-logs"

New-Item -ItemType Directory -Path $LogRoot -Force | Out-Null

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

function Wait-PostgresHealthy {
    foreach ($attempt in 1..60) {
        Start-Sleep -Seconds 1

        $healthOutput = & wsl.exe -d $Distro -- docker inspect --format "{{.State.Health.Status}}" smart-metering-postgres 2>$null
        $health = ""

        if ($null -ne $healthOutput) {
            $health = ($healthOutput | Out-String).Trim()
        }

        if ($health -eq "healthy") {
            Write-Host "PostgreSQL: HEALTHY"
            return
        }

        Write-Host "PostgreSQL health: $health"
    }

    throw "PostgreSQL did not become healthy."
}

function Stop-PortListener {
    param([int]$Port)

    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue

    if ($connections) {
        $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique

        foreach ($pidValue in $pids) {
            Write-Host "Stopping process on port $Port, PID $pidValue"
            Stop-Process -Id $pidValue -Force -ErrorAction SilentlyContinue
        }

        Start-Sleep -Seconds 2
    }
}

function Wait-Http {
    param(
        [string]$Url,
        [string]$Name,
        [System.Diagnostics.Process]$Process
    )

    foreach ($attempt in 1..90) {
        Start-Sleep -Seconds 1

        if ($null -ne $Process -and $Process.HasExited) {
            throw "$Name process exited before becoming ready."
        }

        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                Write-Host "$Name`: READY"
                return
            }
        }
        catch {
        }
    }

    throw "$Name did not become ready: $Url"
}

function Stop-TrackedProcess {
    param(
        [System.Diagnostics.Process]$Process,
        [int]$Port
    )

    if ($null -ne $Process -and -not $Process.HasExited) {
        Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
    }

    Stop-PortListener -Port $Port
}

Set-Location -LiteralPath $RepoRoot

Write-Host ""
Write-Host "===================================================="
Write-Host "FULL ANGULAR + PLAYWRIGHT UI PHASE VERIFICATION"
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
Write-Host "=== 2. Root TypeScript and Playwright unit regression ==="

& npm.cmd run typecheck
if ($LASTEXITCODE -ne 0) {
    throw "Root TypeScript typecheck failed."
}

& npx.cmd playwright test --project=unit
if ($LASTEXITCODE -ne 0) {
    throw "Playwright unit regression failed."
}

Write-Host ""
Write-Host "=== 3. Angular unit tests ==="

Push-Location $FrontendRoot
try {
    & npm.cmd test -- --watch=false
    if ($LASTEXITCODE -ne 0) {
        throw "Angular unit tests failed."
    }

    Write-Host ""
    Write-Host "=== 4. Angular production build ==="

    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) {
        throw "Angular production build failed."
    }
}
finally {
    Pop-Location
}

$keepAlive = $null
$backendProcess = $null
$frontendProcess = $null

try {
    Write-Host ""
    Write-Host "=== 5. WSL/Docker keepalive ==="

    # Do not route the keepalive through `bash -lc`.
    # Start-Process flattens ArgumentList, which can turn "sleep infinity"
    # into `bash -lc sleep infinity`; bash then executes `sleep` without
    # its operand and exits immediately. Invoke sleep directly in WSL.
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
    Wait-Docker

    Write-Host ""
    Write-Host "=== 6. Fresh PostgreSQL ==="

    & wsl.exe -d $Distro -- docker compose -f $ComposeFile down -v --remove-orphans
    & wsl.exe -d $Distro -- docker compose -f $ComposeFile up -d

    if ($LASTEXITCODE -ne 0) {
        throw "PostgreSQL compose startup failed."
    }

    Wait-PostgresHealthy

    Write-Host ""
    Write-Host "=== 7. Spring Boot backend ==="

    Stop-PortListener -Port $BackendPort

    $backendOut = Join-Path $LogRoot "backend.stdout.log"
    $backendErr = Join-Path $LogRoot "backend.stderr.log"

    Remove-Item $backendOut, $backendErr -Force -ErrorAction SilentlyContinue

    $backendProcess = Start-Process `
        -FilePath "java" `
        -ArgumentList @(
            "-jar",
            $Jar,
            "--server.port=$BackendPort",
            "--spring.datasource.url=jdbc:postgresql://127.0.0.1:15432/smart_metering",
            "--spring.datasource.username=smart_metering",
            "--spring.datasource.password=smart_metering"
        ) `
        -RedirectStandardOutput $backendOut `
        -RedirectStandardError $backendErr `
        -PassThru

    Wait-Http -Url "$BackendUrl/api/health" -Name "Backend" -Process $backendProcess

    Write-Host ""
    Write-Host "=== 8. Existing Playwright API suite against PostgreSQL ==="

    $previousApiBaseUrl = $env:API_BASE_URL
    $env:API_BASE_URL = $BackendUrl

    try {
        & npm.cmd run test:api
        if ($LASTEXITCODE -ne 0) {
            throw "Playwright API regression failed."
        }
    }
    finally {
        $env:API_BASE_URL = $previousApiBaseUrl
    }

    Write-Host ""
    Write-Host "=== 9. Angular dev server with API proxy ==="

    Stop-PortListener -Port $FrontendPort

    $frontendOut = Join-Path $LogRoot "frontend.stdout.log"
    $frontendErr = Join-Path $LogRoot "frontend.stderr.log"

    Remove-Item $frontendOut, $frontendErr -Force -ErrorAction SilentlyContinue

    $frontendProcess = Start-Process `
        -FilePath "npm.cmd" `
        -ArgumentList @("start") `
        -WorkingDirectory $FrontendRoot `
        -RedirectStandardOutput $frontendOut `
        -RedirectStandardError $frontendErr `
        -PassThru

    Wait-Http -Url "$FrontendUrl/meters" -Name "Angular frontend" -Process $frontendProcess

    Write-Host ""
    Write-Host "=== 10. Playwright browser UI suite ==="

    if ($keepAlive.HasExited) {
        throw "WSL keepalive exited before the UI suite. ExitCode=$($keepAlive.ExitCode)"
    }

    $preUiContainerStateOutput = & wsl.exe -d $Distro -- docker inspect --format "{{.State.Status}}/{{.State.Health.Status}}" smart-metering-postgres 2>$null
    $preUiContainerState = ""

    if ($null -ne $preUiContainerStateOutput) {
        $preUiContainerState = ($preUiContainerStateOutput | Out-String).Trim()
    }

    Write-Host "PostgreSQL before UI suite: $preUiContainerState"

    if ($preUiContainerState -ne "running/healthy") {
        throw "PostgreSQL is not healthy before the UI suite."
    }

    $previousUiBaseUrl = $env:UI_BASE_URL
    $previousUiApiBaseUrl = $env:UI_API_BASE_URL
    $env:UI_BASE_URL = $FrontendUrl
    $env:UI_API_BASE_URL = $BackendUrl

    try {
        & npm.cmd run test:ui
        if ($LASTEXITCODE -ne 0) {
            throw "Playwright UI suite failed."
        }
    }
    finally {
        $env:UI_BASE_URL = $previousUiBaseUrl
        $env:UI_API_BASE_URL = $previousUiApiBaseUrl
    }

    if ($keepAlive.HasExited) {
        throw "WSL keepalive exited during the UI suite. ExitCode=$($keepAlive.ExitCode)"
    }

    $postUiContainerStateOutput = & wsl.exe -d $Distro -- docker inspect --format "{{.State.Status}}/{{.State.Health.Status}}" smart-metering-postgres 2>$null
    $postUiContainerState = ""

    if ($null -ne $postUiContainerStateOutput) {
        $postUiContainerState = ($postUiContainerStateOutput | Out-String).Trim()
    }

    Write-Host "PostgreSQL after UI suite: $postUiContainerState"

    if ($postUiContainerState -ne "running/healthy") {
        throw "PostgreSQL did not remain healthy through the UI suite."
    }

    Write-Host ""
    Write-Host "===================================================="
    Write-Host "ANGULAR + PLAYWRIGHT UI PHASE VERIFICATION SUCCESS"
    Write-Host "===================================================="
    Write-Host "Backend Maven:              GREEN"
    Write-Host "Root TypeScript:            GREEN"
    Write-Host "Playwright unit:            GREEN"
    Write-Host "Angular unit tests:         GREEN"
    Write-Host "Angular production build:   GREEN"
    Write-Host "PostgreSQL runtime:         GREEN"
    Write-Host "Playwright API regression:  GREEN"
    Write-Host "Angular API proxy:          GREEN"
    Write-Host "Playwright UI Chromium:     GREEN"
}
catch {
    Write-Host ""
    Write-Host "Verification failed: $($_.Exception.Message)"

    if (Test-Path -LiteralPath (Join-Path $LogRoot "backend.stdout.log")) {
        Write-Host ""
        Write-Host "=== BACKEND LOG TAIL ==="
        Get-Content (Join-Path $LogRoot "backend.stdout.log") -Tail 120 -ErrorAction SilentlyContinue
    }

    if (Test-Path -LiteralPath (Join-Path $LogRoot "frontend.stdout.log")) {
        Write-Host ""
        Write-Host "=== FRONTEND LOG TAIL ==="
        Get-Content (Join-Path $LogRoot "frontend.stdout.log") -Tail 120 -ErrorAction SilentlyContinue
    }

    if (Test-Path -LiteralPath (Join-Path $LogRoot "frontend.stderr.log")) {
        Write-Host ""
        Write-Host "=== FRONTEND STDERR TAIL ==="
        Get-Content (Join-Path $LogRoot "frontend.stderr.log") -Tail 120 -ErrorAction SilentlyContinue
    }

    throw
}
finally {
    Stop-TrackedProcess -Process $frontendProcess -Port $FrontendPort
    Stop-TrackedProcess -Process $backendProcess -Port $BackendPort

    try {
        & wsl.exe -d $Distro -- docker compose -f $ComposeFile down -v --remove-orphans
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