#Requires -Version 5.1
<#
.SYNOPSIS
    Windows entry point for the Pana development environment.
.DESCRIPTION
    Pana is one Node process: it serves the hub (web/), every game
    (games/<name>/public), the JSON API (/api/*) and WebSocket rooms (/ws).

    .\dev.ps1                 Start the Pana server (default)
    .\dev.ps1 server          Start the Pana server only
    .\dev.ps1 studio          Open Pana Studio; reuse an existing server
    .\dev.ps1 check           Syntax check + unit tests (npm run check, npm test)
    .\dev.ps1 check -Browser  ...plus every Playwright suite (npm run test:browser)
    .\dev.ps1 setup           First-run setup: npm install

    Options: -Port 8461 -NoAutoPort -NoBrowser
    Environment: PANA_PORT, PANA_HOST, PANA_KILL_PORTS=0 to disable port cleanup.
.EXAMPLE
    .\dev.ps1
    Start the server on http://localhost:8461
.EXAMPLE
    .\dev.ps1 -Port 9000
    Start on a custom port.
#>

$ErrorActionPreference = 'Stop'
$RepoRoot = $PSScriptRoot
$AppRoot = Join-Path $RepoRoot 'Pana'

function Write-Header($text) {
    Write-Host
    Write-Host "=== $text ===" -ForegroundColor Cyan
    Write-Host
}

function Get-DevMode {
    foreach ($arg in $args) {
        if ($arg -in @('start', 'server', 'studio', 'check', 'setup')) {
            return $arg
        }
    }
    return 'start'
}

function Get-DevPort {
    param([string[]]$ArgList)

    for ($i = 0; $i -lt $ArgList.Count; $i++) {
        $arg = [string]$ArgList[$i]
        if ($arg -in @('--port', '-Port') -and ($i + 1) -lt $ArgList.Count) {
            return [int]$ArgList[$i + 1]
        }
        if ($arg.StartsWith('--port=') -or $arg.StartsWith('-Port=')) {
            return [int]($arg -split '=', 2)[1]
        }
    }

    $item = Get-Item -Path 'Env:PANA_PORT' -ErrorAction SilentlyContinue
    if ($item -and $item.Value) {
        return [int]$item.Value
    }

    return 8461
}

function Test-NoAutoPort([string[]]$ArgList) {
    return ($ArgList -contains '--no-auto-port') -or ($ArgList -contains '-NoAutoPort')
}

function Test-PortFree([int]$Port) {
    if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { return $false }
    $listener = $null
    try {
        $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
        $listener.Start()
        return $true
    } catch {
        return $false
    } finally {
        if ($listener) { $listener.Stop() }
    }
}

function Stop-ListenersOnPort {
    param([int]$Port, [string]$Label)

    if ($env:PANA_KILL_PORTS -eq '0') { return }

    $listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique |
        Where-Object { $_ -and $_ -ne 0 -and $_ -ne $PID })

    foreach ($processId in $listeners) {
        $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if (-not $proc) { continue }
        Write-Host "Stopping existing $Label listener on port $Port ($($proc.ProcessName) PID $processId)..." -ForegroundColor Yellow
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
}

function Resolve-DevPort {
    param(
        [string]$Name,
        [int]$Preferred,
        [bool]$NoAutoPort = $false
    )

    if (Test-PortFree $Preferred) {
        return @{ Port = $Preferred; Changed = $false }
    }
    if ($NoAutoPort) {
        throw "$Name port $Preferred is already in use. Stop the other process or omit -NoAutoPort."
    }

    $upper = [Math]::Min($Preferred + 200, 65535)
    for ($candidate = $Preferred + 1; $candidate -le $upper; $candidate++) {
        if (Test-PortFree $candidate) {
            return @{ Port = $candidate; Changed = $true }
        }
    }
    throw "Could not find a free $Name port near $Preferred."
}

function Ensure-Packages {
    $marker = Join-Path $RepoRoot 'node_modules'
    $needsInstall = -not (Test-Path $marker)
    if (-not $needsInstall) {
        $pkg = Get-Item (Join-Path $RepoRoot 'package.json')
        $serverPkg = Get-Item (Join-Path $AppRoot 'server\package.json')
        $nodeModules = Get-Item $marker
        if ($pkg.LastWriteTime -gt $nodeModules.LastWriteTime -or
            $serverPkg.LastWriteTime -gt $nodeModules.LastWriteTime) {
            $needsInstall = $true
        }
    }
    if ($needsInstall) {
        Write-Host 'Installing dependencies (npm install)...' -ForegroundColor Yellow
        & npm.cmd install --prefix $RepoRoot
        if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }
    }
}

function Get-LanIPv4 {
    Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
        Select-Object -First 1 -ExpandProperty IPAddress
}

$mode = Get-DevMode @args
$port = Get-DevPort -ArgList $args
$noAutoPort = Test-NoAutoPort $args
$isHelp = $args -contains '-h' -or $args -contains '--help'

if ($isHelp) {
    Get-Help $PSCommandPath -Detailed
    exit 0
}

function Start-PanaServer {
    param([int]$Port, [bool]$OpenStudio = $false, [bool]$NoBrowser = $false)

    Ensure-Packages
    $env:PANA_PORT = "$Port"
    $proc = Start-Process -FilePath 'node.exe' -WindowStyle Hidden -PassThru -WorkingDirectory $AppRoot `
        -ArgumentList @('server\src\index.js')

    Write-Host 'Press Ctrl+C to stop...' -ForegroundColor DarkGray
    try {
        if ($OpenStudio) {
            $ready = $false
            for ($attempt = 0; $attempt -lt 30 -and -not $proc.HasExited; $attempt++) {
                try { $health = Invoke-RestMethod -Uri "http://localhost:$Port/api/health" -TimeoutSec 3; $ready = $health.ok } catch { }
                if ($ready) { break }
                Start-Sleep -Milliseconds 200
                $proc.Refresh()
            }
            if (-not $ready) { throw 'Pana did not become ready. Check the port and Node installation.' }
            if (-not $NoBrowser) { Start-Process "http://localhost:$Port/studio/library" }
        }
        while (-not $proc.HasExited) {
            Start-Sleep -Milliseconds 500
            $proc.Refresh()
        }
    } finally {
        if (-not $proc.HasExited) {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        }
        Write-Host 'Stopped.'
    }
}

switch ($mode) {
    'studio' {
        $noBrowser = $args -contains '-NoBrowser' -or $args -contains '--no-browser'
        $existing = $false
        try {
            $health = Invoke-RestMethod -Uri "http://localhost:$port/api/health" -TimeoutSec 5
            $page = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:$port/studio/library" -TimeoutSec 5
            $existing = $health.ok -and $page.Content.Contains('Pana Studio')
        } catch { }
        if ($existing) {
            Write-Header 'Pana Studio'
            Write-Host "  Reusing Pana: http://localhost:$port/studio/library"
            if (-not $noBrowser) { Start-Process "http://localhost:$port/studio/library" }
            exit 0
        }
        # Studio must never terminate a running game or an unrelated listener.
        $resolved = Resolve-DevPort -Name 'Pana Studio' -Preferred $port -NoAutoPort $noAutoPort
        Write-Header 'Pana Studio'
        Write-Host "  Studio:       http://localhost:$($resolved.Port)/studio/library"
        Write-Host "  Character:    http://localhost:$($resolved.Port)/personaje.html"
        Start-PanaServer -Port $resolved.Port -OpenStudio $true -NoBrowser $noBrowser
    }
    'check' {
        Write-Header 'Pana checks'
        & node.exe (Join-Path $AppRoot 'server\src\check.js')
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        Write-Header 'Unit tests'
        & npm.cmd test --prefix $RepoRoot
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        if ($args -contains '-Browser' -or $args -contains '--browser') {
            Write-Header 'Browser suites'
            & node.exe (Join-Path $AppRoot 'scripts	est-browser.js')
        }
        exit $LASTEXITCODE
    }
    'setup' {
        Write-Header 'Pana first-run setup'
        & npm.cmd install --prefix $RepoRoot
        if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }
        Write-Host
        Write-Host 'Setup complete. Start the dev environment with .\dev.ps1' -ForegroundColor Green
    }
    default {
        Stop-ListenersOnPort -Port $port -Label 'pana'
        $resolved = Resolve-DevPort -Name 'Pana' -Preferred $port -NoAutoPort $noAutoPort
        $lan = Get-LanIPv4

        Write-Header "Pana dev server"
        Write-Host "  Hub (local):  http://localhost:$($resolved.Port)"
        Write-Host "  Derrape:      http://localhost:$($resolved.Port)/g/derrape/"
        Write-Host "  API health:   http://localhost:$($resolved.Port)/api/health"
        if ($lan) {
            Write-Host "  LAN (panas):  http://${lan}:$($resolved.Port)"
        }
        if ($resolved.Changed) {
            Write-Host "  Note: port $port was busy; using $($resolved.Port)." -ForegroundColor Yellow
        }

        Start-PanaServer -Port $resolved.Port
    }
}
