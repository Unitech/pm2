# pm2.ps1
$pm2Path = Join-Path $PSScriptRoot "../lib/binaries/CLI.js"
node $pm2Path $args
