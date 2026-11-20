# Al-Maheen Academy local development launcher
# Loads only the Resend variables needed by the email notification API,
# without printing their values, then starts the Vercel development server.

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $projectRoot

$envFile = Join-Path $projectRoot ".vercel\.env.development.local"
if (-not (Test-Path -LiteralPath $envFile -PathType Leaf)) {
    Write-Host "Vercel Development environment file was not found:" -ForegroundColor Red
    Write-Host $envFile
    Write-Host "From the project folder, run: vercel pull --environment=development"
    return
}

$requiredNames = @("RESEND_API_KEY", "EMAIL_FROM")
$loadedNames = @()

foreach ($line in [System.IO.File]::ReadAllLines($envFile)) {
    $trimmedLine = $line.Trim()
    if ([string]::IsNullOrWhiteSpace($trimmedLine) -or $trimmedLine.StartsWith("#")) {
        continue
    }

    $match = [regex]::Match(
        $line,
        '^\s*(?<name>RESEND_API_KEY|EMAIL_FROM)\s*=\s*(?<value>.*)$'
    )

    if (-not $match.Success) {
        continue
    }

    $name = $match.Groups["name"].Value
    $value = $match.Groups["value"].Value.Trim()

    # Remove one matching pair of surrounding quotes, if present.
    if ($value.Length -ge 2) {
        $firstCharacter = $value.Substring(0, 1)
        $lastCharacter = $value.Substring($value.Length - 1, 1)
        if (($firstCharacter -eq '"' -and $lastCharacter -eq '"') -or
            ($firstCharacter -eq "'" -and $lastCharacter -eq "'")) {
            $value = $value.Substring(1, $value.Length - 2)
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($value)) {
        Set-Item -Path "Env:$name" -Value $value
        if ($loadedNames -notcontains $name) {
            $loadedNames += $name
        }
    }
}

$missingNames = @($requiredNames | Where-Object { $loadedNames -notcontains $_ })
if ($missingNames.Count -gt 0) {
    Write-Host ("Missing or empty variables in .vercel/.env.development.local: " + ($missingNames -join ", ")) -ForegroundColor Red
    Write-Host "Run: vercel pull --environment=development"
    return
}

if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
    Write-Host "Vercel CLI was not found. Install it or make sure it is available on PATH." -ForegroundColor Red
    return
}

Write-Host "Resend API key loaded: True" -ForegroundColor Green
Write-Host "Email sender loaded: True" -ForegroundColor Green
Write-Host "Starting Al-Maheen Academy with Vercel..." -ForegroundColor Cyan

& vercel dev
if ($LASTEXITCODE -ne 0) {
    Write-Host "Vercel dev exited with code $LASTEXITCODE." -ForegroundColor Yellow
}
