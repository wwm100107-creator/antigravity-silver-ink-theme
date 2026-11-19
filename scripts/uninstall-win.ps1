$ErrorActionPreference = 'Continue'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$PidFile = Join-Path $RepoRoot 'daemon.pid'
$VbsFile = Join-Path $RepoRoot 'silent-start.vbs'

$StartupDir = [Environment]::GetFolderPath('Startup')
$ShortcutPath = Join-Path $StartupDir 'AntigravityCustomTheme.lnk'
if (Test-Path -LiteralPath $ShortcutPath) {
    Remove-Item -LiteralPath $ShortcutPath -Force -ErrorAction SilentlyContinue
    Write-Host "[uninstall-win] Removed Startup shortcut: $ShortcutPath"
}
if (Test-Path -LiteralPath $VbsFile) {
    Remove-Item -LiteralPath $VbsFile -Force -ErrorAction SilentlyContinue
    Write-Host "[uninstall-win] Removed helper script: $VbsFile"
}

if (Test-Path -LiteralPath $PidFile) {
    $PidText = (Get-Content -LiteralPath $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    $DaemonPid = 0
    if ([int]::TryParse(($PidText -as [string]), [ref]$DaemonPid) -and $DaemonPid -gt 0) {
        $Proc = Get-Process -Id $DaemonPid -ErrorAction SilentlyContinue
        if ($Proc -and ($Proc.ProcessName -eq 'agy_theme_daemon' -or $Proc.ProcessName -eq 'node')) {
            Stop-Process -Id $DaemonPid -Force -ErrorAction SilentlyContinue
            Write-Host "[uninstall-win] Stopped daemon ($($Proc.ProcessName), PID $DaemonPid)."
        }
    }
    Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
}

# Clear live injected theme from open Antigravity pages via CDP (zero Node.js dependency)
$PortFile = $env:AGY_PORT_FILE
if (-not $PortFile) {
    $Cand1 = Join-Path $env:APPDATA 'antigravity\DevToolsActivePort'
    $Cand2 = Join-Path $env:APPDATA 'Antigravity\DevToolsActivePort'
    $PortFile = if (Test-Path -LiteralPath $Cand1) { $Cand1 } else { $Cand2 }
}

if ($PortFile -and (Test-Path -LiteralPath $PortFile)) {
    try {
        $PortLine = (Get-Content -LiteralPath $PortFile -ErrorAction Stop | Select-Object -First 1).Trim()
        $Port = [int]$PortLine
        if ($Port -gt 0) {
            $Targets = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json" -TimeoutSec 3
            foreach ($T in $Targets) {
                if ($T.type -eq 'page' -and $T.webSocketDebuggerUrl -and ($T.url -like '*127.0.0.1*')) {
                    $Ws = New-Object System.Net.WebSockets.ClientWebSocket
                    $Cts = New-Object System.Threading.CancellationTokenSource(2500)
                    try {
                        $Ws.ConnectAsync([Uri]$T.webSocketDebuggerUrl, $Cts.Token).GetAwaiter().GetResult()
                        $Payload = '{"id":1,"method":"Runtime.evaluate","params":{"expression":"window.__ANTIGRAVITY_REMOVE_CUSTOM_THEME__ && window.__ANTIGRAVITY_REMOVE_CUSTOM_THEME__();"}}'
                        $Bytes = [System.Text.Encoding]::UTF8.GetBytes($Payload)
                        $Seg = New-Object System.ArraySegment[byte](,$Bytes)
                        $Ws.SendAsync($Seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $Cts.Token).GetAwaiter().GetResult()
                        $Buf = New-Object byte[] 4096
                        $RSeg = New-Object System.ArraySegment[byte](,$Buf)
                        $null = $Ws.ReceiveAsync($RSeg, $Cts.Token).GetAwaiter().GetResult()
                        Write-Host "[uninstall-win] Cleared theme from page $($T.id)."
                    } catch {
                    } finally {
                        $Ws.Dispose()
                        $Cts.Dispose()
                    }
                }
            }
        }
    } catch {
        Write-Host "[uninstall-win] CDP cleanup skipped ($($_.Exception.Message))."
    }
}

Write-Host "[uninstall-win] Done. Antigravity theme removed."
