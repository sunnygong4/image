<#
.SYNOPSIS
  Syncs photos from LRC Saved to the server and triggers Immich + portfolio sync.

.DESCRIPTION
  1. Uses rsync (via WSL) to mirror C:\Users\sunny\Pictures\LRC Saved → server
  2. Triggers Immich external library rescan
  3. Triggers portfolio album sync (so new albums appear on the site)

.PARAMETER Server
  SSH connection string, e.g. host@sunnyserver2

.PARAMETER ServerDest
  Absolute path on the server matching IMMICH_EXTERNAL_LIBRARY_PATH in .env

.PARAMETER DryRun
  Print what would be transferred without actually copying.

.EXAMPLE
  .\sync-to-server.ps1
  .\sync-to-server.ps1 -DryRun
  .\sync-to-server.ps1 -Server user@192.168.1.100 -ServerDest /mnt/nas/photos/library
#>

param(
  [string]$Server    = "host@sunnyserver2",
  [string]$LocalSource = "C:\Users\sunny\Pictures\LRC Saved",
  [string]$ServerDest  = "/mnt/nas/photos/library",
  [string]$EnvFile     = "/opt/image-portfolio/.env",
  [string]$PortfolioUrl = "https://image.sunnygong.com",
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── 1. Rsync via WSL ─────────────────────────────────────────────────────────
# Convert Windows path to WSL path
$wslSource = wsl wslpath -u $LocalSource.Replace('\', '/')
$wslSource = $wslSource.Trim()

$rsyncArgs = @(
  "-avz",
  "--delete",
  "--progress",
  "--exclude=*.lrcat",
  "--exclude=*.lrdata",
  "--exclude=Thumbs.db",
  "--exclude=.DS_Store"
)
if ($DryRun) { $rsyncArgs += "--dry-run" }

Write-Host ""
Write-Host "━━━ Syncing photos to server ━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  From : $LocalSource"
Write-Host "  To   : ${Server}:${ServerDest}"
if ($DryRun) { Write-Host "  Mode : DRY RUN — no files will be transferred" -ForegroundColor Yellow }
Write-Host ""

wsl rsync @rsyncArgs "${wslSource}/" "${Server}:${ServerDest}/"

if ($LASTEXITCODE -ne 0) {
  Write-Error "rsync failed (exit $LASTEXITCODE). Check SSH access and server path."
  exit 1
}

if ($DryRun) {
  Write-Host ""
  Write-Host "Dry run complete. Remove -DryRun to transfer files." -ForegroundColor Yellow
  exit 0
}

# ── 2. Trigger Immich library rescan ─────────────────────────────────────────
Write-Host ""
Write-Host "━━━ Triggering Immich library rescan ━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

$immichScanCmd = @"
set -a && source $EnvFile && set +a
curl -fsS \
  -X POST \
  -H "x-api-key: \$IMMICH_API_KEY" \
  -H "Accept: application/json" \
  "\${IMMICH_URL:-http://localhost:2283}/api/libraries/\${IMMICH_LIBRARY_ID}/scan"
"@

ssh $Server "bash -c '$immichScanCmd'"

if ($LASTEXITCODE -ne 0) {
  Write-Warning "Immich rescan failed — photos are synced but Immich may not have indexed them yet."
  Write-Warning "Run the rescan manually from the Immich admin panel."
} else {
  Write-Host "  Immich rescan triggered." -ForegroundColor Green
}

# ── 3. Trigger portfolio album sync ──────────────────────────────────────────
Write-Host ""
Write-Host "━━━ Triggering portfolio sync ━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

# Give Immich a few seconds to start indexing before we sync
Start-Sleep -Seconds 5

try {
  $syncResponse = Invoke-WebRequest `
    -Method POST `
    -Uri "${PortfolioUrl}/api/admin/immich/sync" `
    -UseBasicParsing

  if ($syncResponse.StatusCode -eq 200) {
    Write-Host "  Portfolio sync triggered." -ForegroundColor Green
  }
} catch {
  Write-Warning "Portfolio sync failed — run 'Sync albums' manually in the admin dashboard."
  Write-Warning $_.Exception.Message
}

Write-Host ""
Write-Host "━━━ All done! ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "  Photos are on the server. Immich is scanning."
Write-Host "  New albums will appear on the site after Immich finishes indexing."
Write-Host "  (This usually takes 1–5 minutes depending on photo count.)"
Write-Host ""
