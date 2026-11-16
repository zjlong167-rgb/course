param([string]$Release = (Get-Date -Format 'yyyyMMdd-HHmmss'))
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot
$stagePath = Join-Path $projectRoot ".local/package-$Release"
if (Test-Path -LiteralPath $stagePath) { throw 'Package directory already exists; choose a new release name' }
New-Item -ItemType Directory -Path $stagePath | Out-Null
$buildPath = Join-Path $projectRoot ".local/build-$Release"
if (Test-Path -LiteralPath $buildPath) { throw 'Build directory already exists; choose a new release name' }
New-Item -ItemType Directory -Path "$buildPath/frontend","$buildPath/docs/evidence" | Out-Null
Copy-Item -LiteralPath package.json,package-lock.json -Destination $buildPath
foreach($directory in @('contracts','samples','scripts')) { Copy-Item -LiteralPath $directory -Destination $buildPath -Recurse }
Copy-Item -LiteralPath frontend/src -Destination "$buildPath/frontend" -Recurse
Get-ChildItem frontend -File | Where-Object { $_.Name -ne '.env' } | Copy-Item -Destination "$buildPath/frontend"
Push-Location $buildPath
try {
 npm ci
 if ($LASTEXITCODE -ne 0) { throw 'isolated npm ci failed' }
 npm run check
 if ($LASTEXITCODE -ne 0) { throw 'isolated checks failed' }
} finally { Pop-Location }
$priorGoos=$env:GOOS; $priorGoarch=$env:GOARCH; $priorCgo=$env:CGO_ENABLED
try {
 $env:GOOS='linux'; $env:GOARCH='amd64'; $env:CGO_ENABLED='0'
 Push-Location backend
 try {
  go build -trimpath -o "$stagePath/course-api-linux" .
  if ($LASTEXITCODE -ne 0) { throw 'API build failed' }
  go build -trimpath -o "$stagePath/course-migrate-linux" ./cmd/migrate
  if ($LASTEXITCODE -ne 0) { throw 'migration build failed' }
 } finally { Pop-Location }
} finally { $env:GOOS=$priorGoos; $env:GOARCH=$priorGoarch; $env:CGO_ENABLED=$priorCgo }
foreach($directory in @('contracts','samples')) { Copy-Item -LiteralPath $directory -Destination $stagePath -Recurse }
New-Item -ItemType Directory -Path "$stagePath/backend","$stagePath/frontend","$stagePath/deploy" | Out-Null
Copy-Item -LiteralPath backend/migrations -Destination "$stagePath/backend" -Recurse
Copy-Item -LiteralPath "$buildPath/frontend/dist" -Destination "$stagePath/frontend" -Recurse
Get-ChildItem deploy -File | Where-Object Name -ne '.env' | Copy-Item -Destination "$stagePath/deploy"
Copy-Item -LiteralPath .dockerignore -Destination $stagePath
$archivePath=Join-Path $projectRoot ".local/course-$Release.tar.gz"
tar -czf $archivePath -C $stagePath .
if ($LASTEXITCODE -ne 0) { throw 'archive failed' }
Get-FileHash -Algorithm SHA256 -LiteralPath $archivePath

