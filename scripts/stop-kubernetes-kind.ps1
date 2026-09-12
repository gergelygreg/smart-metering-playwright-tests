param(
    [string]$RepoRoot = "D:\GitHub\smart-metering-playwright-tests",
    [string]$Distro = "Ubuntu-24.04"
)

$ErrorActionPreference = "Continue"

$LinuxRepo = "/mnt/d/GitHub/smart-metering-playwright-tests"
$RuntimeRoot = Join-Path $RepoRoot ".k8s-runtime"
$KeepAlivePidFile = Join-Path $RuntimeRoot "wsl-k8s-keepalive.pid"
$PortForwardPidFile = Join-Path $RuntimeRoot "port-forward-pids.txt"

if (Test-Path -LiteralPath $PortForwardPidFile) {
    foreach ($line in [System.IO.File]::ReadAllLines($PortForwardPidFile)) {
        $pidValue = 0

        if ([int]::TryParse($line, [ref]$pidValue)) {
            Stop-Process -Id $pidValue -Force -ErrorAction SilentlyContinue
        }
    }

    Remove-Item -LiteralPath $PortForwardPidFile -Force -ErrorAction SilentlyContinue
}

& wsl.exe `
    -d $Distro `
    -- `
    bash `
    -lc `
    "cd '$LinuxRepo' && bash ./scripts/k8s/destroy-cluster.sh"

if (Test-Path -LiteralPath $KeepAlivePidFile) {
    $pidValue = 0

    [void][int]::TryParse(
        ([System.IO.File]::ReadAllText($KeepAlivePidFile)).Trim(),
        [ref]$pidValue
    )

    if ($pidValue -gt 0) {
        Stop-Process -Id $pidValue -Force -ErrorAction SilentlyContinue
    }

    Remove-Item -LiteralPath $KeepAlivePidFile -Force -ErrorAction SilentlyContinue
}

Write-Host "Kubernetes kind stack stopped."
