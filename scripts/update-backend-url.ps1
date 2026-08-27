# ─────────────────────────────────────────────────────────────────────────────
#  Update Back4App backend URL everywhere + push.
#
#  USAGE (from repo root):
#     powershell -ExecutionPolicy Bypass -File scripts\update-backend-url.ps1 <new-url>
#
#  EXAMPLE:
#     powershell -ExecutionPolicy Bypass -File scripts\update-backend-url.ps1 https://visioncollegiateapi-xxxx.b4a.run
#
#  After running this:
#     1. Vercel rebuilds the frontend automatically (git push triggers it).
#     2. If you also set BACKEND_URL in Vercel, that value wins over the files.
# ─────────────────────────────────────────────────────────────────────────────

param(
    [Parameter(Mandatory = $true)]
    [string]$NewUrl
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

# Normalise: accept with or without trailing slash
$NewUrl = $NewUrl.TrimEnd('/')

if ($NewUrl -notmatch '^https?://') {
    Write-Error "URL must start with http:// or https:// (got '$NewUrl')"
}

Write-Host "--- Updating backend URL to: $NewUrl ---"

# Regex that matches old Back4App container URLs (any hash)
$pattern = 'https?://visioncollegiateapi-[a-z0-9]+\.b4a\.run'

$files = @(
    'frontend\next.config.mjs',
    'frontend\.env.local',
    'mobile\services\api.ts',
    'mobile\eas.json'
)

$changed = @()
foreach ($f in $files) {
    if (-not (Test-Path -LiteralPath $f)) {
        Write-Host "  skip  (missing) -> $f"
        continue
    }
    $content = Get-Content -LiteralPath $f -Raw
    if ($content -notmatch $pattern) {
        Write-Host "  skip  (no old URL) -> $f"
        continue
    }
    $updated = $content -replace $pattern, $NewUrl
    Set-Content -LiteralPath $f -Value $updated -NoNewline -Encoding utf8
    Write-Host "  updated -> $f"
    $changed += $f
}

if ($changed.Count -eq 0) {
    Write-Host "Nothing to update. The files already point at '$NewUrl' (or have no b4a.run URL)."
    Write-Host "If you set BACKEND_URL in Vercel, that is what the frontend uses."
    exit 0
}

Write-Host ""
Write-Host "--- Committing and pushing ---"
git add -A
git commit -m "fix: update backend URL to $NewUrl"
git push
if ($LASTEXITCODE -ne 0) {
    Write-Error "Git push failed. Check the output above."
}

Write-Host ""
Write-Host "DONE. Waiting ~1-2 min for Vercel to build, then hard-refresh your app."
Write-Host ""
Write-Host "TIP: If Back4App gives you a NEW url again you only need to run this script again."