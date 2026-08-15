param(
  [string]$OutputDirectory = ""
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

if (-not $OutputDirectory) {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $OutputDirectory = Join-Path $projectRoot "dist\nodex-closed-$stamp"
}

if (Test-Path -LiteralPath $OutputDirectory) {
  throw "Delivery directory already exists: $OutputDirectory"
}

$sourceArchive = Join-Path $OutputDirectory 'nodex-source.zip'
$imagesArchive = Join-Path $OutputDirectory 'nodex-images.tar'
New-Item -ItemType Directory -Path $OutputDirectory | Out-Null

Write-Host 'Building closed-contour images...'
docker compose --env-file .env.closed.example -f docker-compose.closed.yml build
if ($LASTEXITCODE -ne 0) { throw 'Docker image build failed.' }

Write-Host 'Saving images for offline transfer...'
docker save -o $imagesArchive nodex/app:pilot nodex/frontend:pilot postgres:15-alpine redis:7-alpine
if ($LASTEXITCODE -ne 0) { throw 'Docker image export failed.' }

Write-Host 'Archiving source from current commit...'
git archive --format=zip --output=$sourceArchive HEAD
if ($LASTEXITCODE -ne 0) { throw 'Source archive creation failed.' }

Copy-Item -LiteralPath '.env.closed.example' -Destination (Join-Path $OutputDirectory '.env.closed.example')
Copy-Item -LiteralPath 'docker-compose.closed.yml' -Destination (Join-Path $OutputDirectory 'docker-compose.closed.yml')
Copy-Item -LiteralPath 'docs\closed-contour-deployment.md' -Destination (Join-Path $OutputDirectory 'README.md')

Get-ChildItem -LiteralPath $OutputDirectory -File |
  Get-FileHash -Algorithm SHA256 |
  ForEach-Object { "{0}  {1}" -f $_.Hash.ToLowerInvariant(), $_.Path.Substring($OutputDirectory.Length + 1) } |
  Set-Content -LiteralPath (Join-Path $OutputDirectory 'SHA256SUMS.txt') -Encoding utf8

Write-Host "Delivery is ready: $OutputDirectory"
