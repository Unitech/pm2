#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

cd $file_path

echo -e "\033[1mRunning tests:\033[0m"

$pm2 kill

>out-rel.log

$pm2 start echo.js -o out-rel.log --merge-logs

$pm2 reloadLogs

sleep 1

grep "Reloading log..." out-rel.log

spec "Should have started the reloading action"
