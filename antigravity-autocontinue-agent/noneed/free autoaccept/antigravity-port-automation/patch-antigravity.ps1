$UserAppData = $env:LOCALAPPDATA
$AntigravityMainJsPath = "$UserAppData\Programs\Antigravity\resources\app\out\main.js"

if (Test-Path $AntigravityMainJsPath) {
    $Content = Get-Content -Raw -Path $AntigravityMainJsPath

    # Check if the patch is already applied
    if ($Content -notmatch "process.argv.push\('--remote-debugging-port=9000'\)") {
        Write-Host "Applying patch to main.js..."
        $Patch = "if(!process.argv.includes('--remote-debugging-port=9000')) { process.argv.push('--remote-debugging-port=9000'); }`n"
        $NewContent = $Patch + $Content
        
        Set-Content -Path $AntigravityMainJsPath -Value $NewContent -NoNewline
        Write-Host "Patch applied successfully!"
    } else {
        Write-Host "main.js is already patched."
    }
} else {
    Write-Host "Antigravity main.js not found at $AntigravityMainJsPath"
}
