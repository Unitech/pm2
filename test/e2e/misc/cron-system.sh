#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path

PM2_WORKER_INTERVAL=1000 $pm2 update
$pm2 delete all
#
#
#

$pm2 start cron.js -c "*/2 * * * * *" --no-vizion
spec "Should cron restart echo.js"
sleep 2
should 'should app been restarted' 'restart_time: 0' 0

$pm2 restart cron
$pm2 reset all
sleep 2
should 'should app been restarted after restart' 'restart_time: 0' 0

$pm2 reset cron
$pm2 stop cron
sleep 3
should 'should app be started again' 'online' 1

$pm2 delete cron
sleep 2
should 'should app not be started again' 'stopped' 0
should 'should app not be started again' 'online' 0

$pm2 delete all
#
# Cron
#
$pm2 start cron.js -c "* * * asdasd"
ispec "Cron should throw error when pattern invalid"

$pm2 start cron.js -c "* * * * * *"
spec "Should cron restart echo.js"

$pm2 delete all

> mock.log

$pm2 start cron/mock-cron.js -o mock.log
sleep 3
should 'should app been restarted when cron in fork mode' 'restart_time: 0' 0
cat mock.log | grep "SIGINT"
spec "1# Should cron exit call SIGINT handler"

$pm2 delete all

$pm2 start cron/mock-cron.js -o mock.log -i 1
sleep 3
should 'should app been restarted when cron in cluster mode' 'restart_time: 0' 0
cat mock.log | grep "SIGINT"
spec "2# Should cron exit call SIGINT handler"

$pm2 delete all
## No exit

$pm2 start cron/mock-cron-no-exit.js -o mock.log
sleep 3
should 'should app been restarted' 'restart_time: 0' 0
cat mock.log | grep "SIGINT"
spec "3# Should cron exit call SIGINT handler"


# $pm2 restart cron
