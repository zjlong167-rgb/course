$ErrorActionPreference='Stop'
$repoRoot=Split-Path $PSScriptRoot -Parent
$mysqlClient=Join-Path $repoRoot '.local/mysql-8.4.13-winx64/bin/mysql.exe'
# Only valid for a freshly initialized local data directory. No production defaults.
& $mysqlClient --no-defaults -h 127.0.0.1 -P 3307 -u root --execute="ALTER USER 'root'@'localhost' IDENTIFIED BY 'root_local_only'; CREATE DATABASE course CHARACTER SET utf8mb4; CREATE USER 'course'@'localhost' IDENTIFIED BY 'course_local_only'; GRANT ALL ON course.* TO 'course'@'localhost';"
if ($LASTEXITCODE -ne 0) {throw 'Initialization failed. Do not rerun against existing data; inspect server log.'}
