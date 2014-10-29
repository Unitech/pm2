#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

cd $file_path

echo -e "\033[1mRunning tests:\033[0m"

####################################################################
# Check that we can start a process from inside a PM2 watched app. #
####################################################################

$pm2 kill

TEST_VARIABLE='hello1' $pm2 start startProcessInsidePm2.json
>inside-out-1.log

sleep 1

should 'start master process' 'pm_id: 0' 2

sleep 1

$pm2 list

should 'child process should be started' 'pm_id: 1' 2
should 'restarted status should be zero' "restart_time: 0" 2

grep "hello1" inside-out-1.log &> /dev/null
spec "Child should have hello1 variable"

TEST_VARIABLE='hello2' $pm2 restart "insideProcess"
sleep 1
grep "hello2" inside-out-1.log &> /dev/null
spec "Child should have hello2 variable after restart"

$pm2 kill


