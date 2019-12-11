#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path

####################################################################
# Check that we can start a process from inside a PM2 watched app. #
####################################################################

TEST_VARIABLE='hello1' $pm2 start startProcessInsidePm2.json
>inside-out.log

sleep 1

should 'start master process' 'pm_id: 0' 2

sleep 1

$pm2 list

should 'child process should be started' 'pm_id: 1' 2
should 'restarted status should be zero' "restart_time: 0" 2

grep "hello1" inside-out.log &> /dev/null
spec "Child should have hello1 variable"

TEST_VARIABLE='hello2' $pm2 restart "insideProcess" --update-env
sleep 1
grep "hello2" inside-out.log &> /dev/null
spec "Child should have hello2 variable after restart"

# Call bash script that restarts app
$pm2 delete all

$pm2 start echo.js
sleep 1

export PM2_PATH=$pm2
$pm2 start inside/inner_restart.sh --no-autorestart
sleep 2
should 'restarted status should be one' "restart_time: 3" 1
