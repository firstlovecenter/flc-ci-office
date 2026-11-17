<#
.SYNOPSIS
    Migrate, build, commit, push, and deploy to Cloudflare Workers.

.USAGE
    powershell -ExecutionPolicy Bypass -File scripts/ship.ps1 -Message "fix: ..."

.NOTES
    Runs prisma migrate deploy against the production database (via
    RUN_MIGRATIONS=1), builds with opennextjs-cloudflare, commits,
    pushes to GitHub, then deploys to Cloudflare Workers.
    No repo visibility flipping needed -- Cloudflare deploys from the CLI.
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$Message
)

$ErrorActionPreference = "Stop"

try {
    Write-Host "==> [1/4] Running migrations..." -ForegroundColor Cyan
    # Run via bash: PowerShell's Windows TLS stack causes advisory-lock timeouts
    # on Neon's pooler; bash (Git Bash / POSIX layer) connects cleanly.
    # migrate.sh also sets DATABASE_URL_UNPOOLED to prevent migrate-on-deploy
    # from deriving and trying to reach the unreachable unpooled endpoint.
    bash scripts/migrate.sh
    if ($LASTEXITCODE -ne 0) {
        Write-Host "!! WARNING: migrations did not complete. Verify manually before deploying schema changes." -ForegroundColor Yellow
    }

    Write-Host "==> [2/4] Building for Cloudflare Workers..." -ForegroundColor Cyan
    npx opennextjs-cloudflare build
    if ($LASTEXITCODE -ne 0) { throw "Cloudflare build failed - not committing or deploying." }

    Write-Host "==> [3/4] Committing and pushing to GitHub..." -ForegroundColor Cyan
    git add -A
    git commit -m $Message
    if ($LASTEXITCODE -ne 0) { throw "Nothing to commit (or commit failed)." }
    git push origin HEAD
    if ($LASTEXITCODE -ne 0) { throw "Push failed." }

    Write-Host "==> [4/4] Deploying to Cloudflare Workers..." -ForegroundColor Cyan
    npx opennextjs-cloudflare deploy
    if ($LASTEXITCODE -ne 0) { throw "Cloudflare deploy failed." }

    Write-Host "==> Done! Deployed to Cloudflare Workers." -ForegroundColor Green
}
catch {
    Write-Host "!! ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
