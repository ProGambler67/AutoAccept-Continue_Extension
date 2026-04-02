$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$PatchScript = "$ScriptDir\patch-antigravity.ps1"

Write-Host "Executing patch script directly for immediate effect..."
& $PatchScript

Write-Host "Creating Scheduled Task to run the patch script on user logon..."

$TaskName = "AntigravityAutoAcceptPatch"
$Action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$PatchScript`""
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive

# Register / overwrite the task
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Force

Write-Host "Installation Complete! Scheduled task created."
