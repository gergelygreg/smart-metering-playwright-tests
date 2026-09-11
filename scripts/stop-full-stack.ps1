param(
    [string]$RepoRoot = "D:\GitHub\smart-metering-playwright-tests",
    [switch]$RemoveVolumes
)

$ErrorActionPreference = "Stop"

$Distro = "Ubuntu-24.04"
$LinuxRepo = "/mnt/d/GitHub/smart-metering-playwright-tests"
$ComposeFile = "$LinuxRepo/docker-compose.full.yml"
$RuntimeRoot = Join-Path $RepoRoot ".docker-runtime"
$PidFile = Join-Path $RuntimeRoot "wsl-keepalive.pid"

Set-Location -LiteralPath $RepoRoot

$downArgs = @(
    "-d",
    $Distro,
    "--",
    "docker",
    "compose",
    "-f",
    $ComposeFile,
    "down",
    "--remove-orphans"
)

if ($RemoveVolumes) {
    $downArgs += "--volumes"
}

try {
    & wsl.exe @downArgs
}
finally {
    if (Test-Path -LiteralPath $PidFile) {
        $keepAlivePid = 0
        [void][int]::TryParse(
            ([System.IO.File]::ReadAllText($PidFile)).Trim(),
            [ref]$keepAlivePid
        )

        if ($keepAlivePid -gt 0) {
            Stop-Process -Id $keepAlivePid -Force -ErrorAction SilentlyContinue
        }

        Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
    }

    if (Test-Path -LiteralPath $RuntimeRoot) {
        $remaining = @(Get-ChildItem -LiteralPath $RuntimeRoot -Force -ErrorAction SilentlyContinue)
        if ($remaining.Count -eq 0) {
            Remove-Item -LiteralPath $RuntimeRoot -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-Host "Full Docker stack stopped."
if ($RemoveVolumes) {
    Write-Host "PostgreSQL Docker volume removed."
}
else {
    Write-Host "PostgreSQL Docker volume preserved."
}