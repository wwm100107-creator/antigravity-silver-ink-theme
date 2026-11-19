param(
    [switch]$NoStartup,
    [ValidateSet('', 'Ultra', 'Lite')]
    [string]$Profile = ''
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$DaemonJs = Join-Path $RepoRoot 'daemon\theme_daemon.js'
$PayloadJs = Join-Path $RepoRoot 'dist\theme_payload.js'
$BuildPy = Join-Path $RepoRoot 'scripts\build_payload.py'
$ConfigJson = Join-Path $RepoRoot 'theme_config.json'
$PidFile = Join-Path $RepoRoot 'daemon.pid'
$VbsPath = Join-Path $RepoRoot 'silent-start.vbs'

$NodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $NodeCmd) {
    Write-Error "Node.js not found in PATH. Install Node.js >= 22 first."
}
$NodeExe = $NodeCmd.Source
$NodeMajor = [int]((& $NodeExe -p "process.versions.node.split('.')[0]").Trim())
if ($NodeMajor -lt 22) {
    Write-Error "Node.js >= 22 is required (found v$NodeMajor at $NodeExe)."
}

if (-not (Test-Path $PayloadJs)) {
    $PyCmd = Get-Command python -ErrorAction SilentlyContinue
    if (-not $PyCmd) {
        $PyCmd = Get-Command python3 -ErrorAction SilentlyContinue
    }
    if (-not $PyCmd) {
        Write-Error "dist/theme_payload.js is missing and Python was not found to build it."
    }
    Write-Host "[install-win] Building dist/theme_payload.js..."
    if ($Profile) {
        & $PyCmd.Source $BuildPy --profile ($Profile.ToLower())
    } else {
        & $PyCmd.Source $BuildPy
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Error "build_payload.py failed with exit code $LASTEXITCODE."
    }
}

if ($Profile) {
    $NormalizedProfile = $Profile.ToLower()
    $CfgObj = @{}
    if (Test-Path $ConfigJson) {
        try {
            $RawJson = [System.IO.File]::ReadAllText($ConfigJson, [System.Text.Encoding]::UTF8)
            $Parsed = ConvertFrom-Json -InputObject $RawJson
            if ($Parsed) {
                foreach ($Prop in $Parsed.PSObject.Properties) {
                    $CfgObj[$Prop.Name] = $Prop.Value
                }
            }
        } catch {
            $CfgObj = @{}
        }
    }
    $CfgObj['performanceMode'] = $NormalizedProfile
    $JsonOut = $CfgObj | ConvertTo-Json -Depth 6
    [System.IO.File]::WriteAllText($ConfigJson, $JsonOut, [System.Text.UTF8Encoding]::new($false))
    Write-Host "[install-win] Set performanceMode=$NormalizedProfile in theme_config.json."
}

if (Test-Path $PidFile) {
    $OldPidText = (Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    $OldPid = 0
    if ([int]::TryParse(($OldPidText -as [string]), [ref]$OldPid) -and $OldPid -gt 0) {
        $ExistingProc = Get-Process -Id $OldPid -ErrorAction SilentlyContinue
        if ($ExistingProc -and $ExistingProc.ProcessName -eq 'node') {
            Write-Host "[install-win] Stopping existing daemon (PID $OldPid)..."
            Stop-Process -Id $OldPid -Force -ErrorAction SilentlyContinue
            Start-Sleep -Milliseconds 350
        }
    }
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

# Generate silent-start.vbs dynamically without hardcoding user or Node paths.
$EscapedNode = $NodeExe.Replace('"', '""')
$EscapedDaemon = $DaemonJs.Replace('"', '""')
$VbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "$($RepoRoot.Replace('"', '""'))"
WshShell.Run """$EscapedNode"" --max-old-space-size=48 ""$EscapedDaemon""", 0, False
"@
Set-Content -Path $VbsPath -Value $VbsContent -Encoding ASCII

if (-not $NoStartup) {
    $StartupDir = [Environment]::GetFolderPath('Startup')
    $ShortcutPath = Join-Path $StartupDir 'AntigravityCustomTheme.lnk'
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
    $Shortcut.TargetPath = 'wscript.exe'
    $Shortcut.Arguments = """$VbsPath"""
    $Shortcut.WorkingDirectory = $RepoRoot
    $Shortcut.WindowStyle = 7
    $Shortcut.Description = 'Antigravity Custom Theme Daemon'
    $Shortcut.Save()
    Write-Host "[install-win] Startup shortcut created: $ShortcutPath"
}

Write-Host "[install-win] Launching daemon via wscript.exe..."
Start-Process -FilePath 'wscript.exe' -ArgumentList """$VbsPath""" -WorkingDirectory $RepoRoot

for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Milliseconds 250
    if (Test-Path $PidFile) {
        $NewPidText = (Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
        $NewPid = 0
        if ([int]::TryParse(($NewPidText -as [string]), [ref]$NewPid) -and $NewPid -gt 0) {
            if (Get-Process -Id $NewPid -ErrorAction SilentlyContinue) {
                Write-Host "[install-win] Daemon running silently (PID $NewPid)."
                exit 0
            }
        }
    }
}

Write-Warning "[install-win] Daemon did not write daemon.pid in time. Check $RepoRoot\daemon.log."
exit 1
