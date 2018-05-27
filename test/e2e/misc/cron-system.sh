#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path

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


exit

#
# Slow test
#
$pm2 start signals/delayed_sigint.js -c "1 * * * * *" -o cron.log
spec "Should cron restart delayed sigint"

sleep 100

cat cron.log | grep "SIGINT cb called"
spec "Should cron exit call SIGINT handler"

should 'should app been restarted' 'restart_time: 1' 1
