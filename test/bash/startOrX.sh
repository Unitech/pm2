#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

echo -e "\033[1mStartOrX.sh:\033[0m"

cd $file_path

$pm2 startOrRestart all.json

should 'should start processes' 'online' 6

$pm2 startOrRestart all.json

should 'should has restarted app' 'restart_time: 1' 6

$pm2 startOrReload all.json

should 'should has reloaded app' 'restart_time: 2' 6

# slow
# $pm2 startOrGracefulReload all.json
# should 'should has graceful reloaded app' 'restart_time: 3' 8
