#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"
cd $file_path

echo -e "\033[1mRunning tests for json files :\033[0m"

$pm2 start echo.js --name zero -f
$pm2 start echo.js --name one -f
$pm2 start echo.js --name two -f
should 'should have 3 processes online' 'online' 3
$pm2 stop 0
$pm2 stop 2
$pm2 start echo.js --name three -f
$pm2 ls
should 'should have 2 processes online' 'online' 2
should 'should have 2 processes stopped' 'stopped' 2
