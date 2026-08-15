param(
  [string]$OutputDirectory = "",
  [switch]$IncludeImages
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

if (-not $OutputDirectory) {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $OutputDirectory = Join-Path $projectRoot "dist\nodex-update-$stamp"
}
if (Test-Path -LiteralPath $OutputDirectory) { throw "Update directory already exists: $OutputDirectory" }

New-Item -ItemType Directory -Path $OutputDirectory | Out-Null
New-Item -ItemType Directory -Path (Join-Path $OutputDirectory 'plugins') | Out-Null

Get-ChildItem -LiteralPath 'plugins' -Force | Copy-Item -Destination (Join-Path $OutputDirectory 'plugins') -Recurse -Force
Copy-Item -LiteralPath 'docker-compose.closed.yml' -Destination (Join-Path $OutputDirectory 'docker-compose.closed.yml')

@'
#!/usr/bin/env bash
set -euo pipefail

bundle_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
deployment_dir="${NODEX_HOME:-$(cd "$bundle_dir/.." && pwd)}"

[[ -f "$deployment_dir/docker-compose.closed.yml" ]] || { echo "Nodex deployment directory was not found: $deployment_dir" >&2; exit 1; }
[[ -f "$deployment_dir/.env.closed" ]] || { echo "Missing $deployment_dir/.env.closed" >&2; exit 1; }

images_tar="${NODEX_IMAGES_TAR:-$bundle_dir/images.tar}"
[[ -f "$images_tar" ]] || { echo "Missing Docker images archive: $images_tar" >&2; exit 1; }
docker load -i "$images_tar"
backup_dir="$deployment_dir/plugins.before-$(date +%Y%m%d-%H%M%S)"
if [[ -d "$deployment_dir/plugins" ]]; then
  mv "$deployment_dir/plugins" "$backup_dir"
  echo "Previous plugins saved to: $backup_dir"
fi
mkdir -p "$deployment_dir/plugins"
cp -a "$bundle_dir/plugins/." "$deployment_dir/plugins/"
cp "$bundle_dir/docker-compose.closed.yml" "$deployment_dir/docker-compose.closed.yml"

cd "$deployment_dir"
docker compose --env-file .env.closed -f docker-compose.closed.yml up -d --no-build --force-recreate app frontend
docker compose --env-file .env.closed -f docker-compose.closed.yml ps

node_port="$(grep -E '^NODEX_PORT=' .env.closed | tail -n 1 | cut -d= -f2 | tr -d '[:space:]')"
node_port="${node_port:-8080}"
if command -v curl >/dev/null 2>&1; then
  curl -fsS "http://127.0.0.1:${node_port}/health" || true
fi
'@ | Set-Content -LiteralPath (Join-Path $OutputDirectory 'install-update.sh') -NoNewline -Encoding utf8

@'
Nodex update for Ubuntu (offline)

The update does not require Internet access. Docker images are supplied separately
as nodex-images.tar from the closed-contour delivery unless this archive includes
an images.tar file.

1. Copy this TAR.GZ archive to the Ubuntu server.
2. Extract it in or next to the existing Nodex deployment directory:

   tar -xzf nodex-update-*.tar.gz
   cd nodex-update-*

3. Run the update. Point NODEX_IMAGES_TAR to nodex-images.tar if it is not in this
   extracted directory. If the Nodex installation is not the parent directory of this
   extracted folder, specify it through NODEX_HOME:

   sudo NODEX_HOME=/opt/nodex NODEX_IMAGES_TAR=/mnt/nodex-images.tar ./install-update.sh

4. Verify the service:

   curl http://127.0.0.1:8080/health

The script loads images, backs up the current plugins directory as
plugins.before-YYYYMMDD-HHMMSS, replaces bundled plugins and restarts only app
and frontend with --no-build. PostgreSQL, Redis and project data are preserved.
'@ | Set-Content -LiteralPath (Join-Path $OutputDirectory 'README.txt') -NoNewline -Encoding utf8

if ($IncludeImages) {
  Write-Host 'Saving update Docker images...'
  docker save -o (Join-Path $OutputDirectory 'images.tar') nodex/app:pilot nodex/frontend:pilot postgres:15-alpine redis:7-alpine
  if ($LASTEXITCODE -ne 0) { throw 'Docker image export failed.' }
}

$archivePath = "$OutputDirectory.tar.gz"
Write-Host 'Creating Ubuntu update archive...'
tar.exe -czf $archivePath -C (Split-Path -Parent $OutputDirectory) (Split-Path -Leaf $OutputDirectory)
if ($LASTEXITCODE -ne 0) { throw 'TAR archive creation failed.' }
Write-Host "Ubuntu update is ready: $archivePath"
