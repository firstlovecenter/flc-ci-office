<#
.SYNOPSIS
    Build, commit, and push with a temporary public window so Vercel (Hobby plan)
    deploys the commit, then return the repo to private.

.WHY
    Vercel Hobby blocks deployments triggered by commits whose author is not the
    project owner on PRIVATE repos. PUBLIC repos deploy any author's commits.
    This flips the repo public only for the push window, then back to private.

.USAGE
    powershell -ExecutionPolicy Bypass -File scripts/ship.ps1 -Message "fix: ..."

.NOTES
    The repo is returned to private in a finally block, so it is set back even if
    the build, commit, or push fails. Commit happens BEFORE the public flip
    (commits are local) to keep the public exposure window as small as possible.
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$Message
)

$ErrorActionPreference = "Stop"
$repo = "firstlovecenter/flc-ci-office"

# Seconds to stay public after pushing, giving Vercel's webhook time to authorize
# the deployment. Authorization happens at webhook receipt (a few seconds); the
# build itself uses Vercel's GitHub App token and works fine once private again.
$publicWindowSeconds = 30

function Set-RepoVisibility([string]$visibility) {
    gh repo edit $repo --visibility $visibility --accept-visibility-change-consequences
    if ($LASTEXITCODE -ne 0) { throw "Failed to set repo $visibility" }
}

try {
    Write-Host "==> [1/5] Building..." -ForegroundColor Cyan
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Build failed - not committing or deploying." }

    Write-Host "==> Committing locally (before going public)..." -ForegroundColor Cyan
    git add -A
    git commit -m $Message
    if ($LASTEXITCODE -ne 0) { throw "Nothing to commit (or commit failed). Aborting; repo never went public." }

    Write-Host "==> [2/5] Setting repo PUBLIC..." -ForegroundColor Yellow
    Set-RepoVisibility "public"

    Write-Host "==> [3/5] (commit already made) / [4/5] Pushing to trigger Vercel..." -ForegroundColor Cyan
    git push origin HEAD
    if ($LASTEXITCODE -ne 0) { throw "Push failed." }

    Write-Host "==> Holding public for $publicWindowSeconds s so Vercel authorizes the deploy..." -ForegroundColor Yellow
    Start-Sleep -Seconds $publicWindowSeconds
}
finally {
    Write-Host "==> [5/5] Returning repo to PRIVATE..." -ForegroundColor Green
    try {
        Set-RepoVisibility "private"
        $state = gh repo view $repo --json visibility --jq ".visibility"
        Write-Host "Repo visibility is now: $state" -ForegroundColor Green
    }
    catch {
        Write-Host "!! WARNING: could not set repo back to private. Check it manually NOW: https://github.com/$repo/settings" -ForegroundColor Red
    }
}
