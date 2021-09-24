#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path

PM2_WORKER_INTERVAL=1000 $pm2 update
$pm2 delete all

#
# Cron wrong format detection
#
$pm2 start cron.js -c "* * * asdasd"
ispec "Cron should throw error when pattern invalid"

#
# Cron restart in fork mode
#
$pm2 start cron.js -c "*/2 * * * * *" --no-vizion
spec "Should cron restart echo.js"
sleep 2
should 'should app been restarted' 'restart_time: 0' 0

$pm2 restart cron
$pm2 reset all
sleep 4
should 'should app been restarted after restart' 'restart_time: 0' 0

$pm2 reset cron
$pm2 stop cron
sleep 4
should 'should app be started again' 'online' 1

$pm2 delete cron
sleep 4
should 'should app not be started again' 'stopped' 0
should 'should app not be started again' 'online' 0

$pm2 delete all

#
# Cron restart in cluster mode
#
$pm2 start cron.js -i 1 -c "*/2 * * * * *"
spec "Should start app"
sleep 2
should 'should app been restarted' 'restart_time: 0' 0
$pm2 reset all
sleep 3
should 'should app been restarted a second time' 'restart_time: 0' 0

$pm2 delete all

#
# Cron after resurect
#
$pm2 start cron.js -i 1 -c "*/2 * * * * *"
spec "Should start app"
sleep 2
should 'should app been restarted' 'restart_time: 0' 0

$pm2 update
$pm2 reset all
sleep 4
should 'should app been restarted' 'restart_time: 0' 0

$pm2 delete all

#
# Cron every sec
#
$pm2 start cron.js -c "* * * * * *"
sleep 4
should 'should app been restarted' 'restart_time: 0' 0

#
# Delete cron
#
$pm2 restart cron --cron-restart 0
$pm2 reset all
sleep 2
should 'app stop be restarted' 'restart_time: 0' 1

$pm2 delete all
