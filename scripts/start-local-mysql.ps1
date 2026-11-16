param([switch]$Download)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$localRoot = Join-Path $repoRoot '.local'
$mysqlRoot = Join-Path $localRoot 'mysql-8.4.13-winx64'
$dataRoot = Join-Path $localRoot 'mysql-data'
New-Item -ItemType Directory -Force $localRoot | Out-Null
if (Get-NetTCPConnection -LocalPort 3307 -State Listen -ErrorAction SilentlyContinue) { throw 'Port 3307 is already in use. Stop your existing local database before starting another.' }
if (-not (Test-Path "$mysqlRoot/bin/mysqld.exe")) {
    if (-not $Download) { throw 'Run with -Download to fetch the pinned official MySQL ZIP.' }
    $archive = Join-Path $localRoot 'mysql-8.4.13-winx64.zip'
    if (-not (Test-Path $archive)) { Invoke-WebRequest 'https://cdn.mysql.com/Downloads/MySQL-8.4/mysql-8.4.13-winx64.zip' -OutFile $archive }
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne 'E9CD98B1D23F122987B1AFCA26AD942EFEC5891481103D48AE3CDE237FA3EA54') { throw 'Pinned ZIP SHA256 mismatch.' }
    Expand-Archive -LiteralPath $archive -DestinationPath $localRoot
}
if (-not (Test-Path $dataRoot)) {
    & "$mysqlRoot/bin/mysqld.exe" --no-defaults --initialize-insecure "--basedir=$mysqlRoot" "--datadir=$dataRoot" --console
    if ($LASTEXITCODE -ne 0) { throw 'MySQL initialization failed.' }
}
# No service installation, no firewall modification, loopback only.
$mysqlProcess = Start-Process -FilePath "$mysqlRoot/bin/mysqld.exe" -ArgumentList @('--no-defaults',"--basedir=$mysqlRoot","--datadir=$dataRoot",'--bind-address=127.0.0.1','--port=3307','--mysqlx=OFF','--console') -WindowStyle Hidden -PassThru -RedirectStandardOutput "$localRoot/mysql.stdout.log" -RedirectStandardError "$localRoot/mysql.stderr.log"
$mysqlProcess.Id | Set-Content "$localRoot/mysql.pid"
Write-Host "MySQL PID $($mysqlProcess.Id), port 3307. Wait for ready in .local/mysql.stderr.log."
Write-Host 'First initialization only: run scripts/init-local-mysql.ps1 to set the local password and create the database.'
