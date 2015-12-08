
#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

cd $file_path

echo -e "\033[1mRunning tests:\033[0m"

#
# Max memory auto restart option
#
# --max-memory-restart option && maxMemoryRestart (via JSON file)
#
$pm2 kill

PM2_WORKER_INTERVAL=1000 $pm2 start max-mem-0.json
sleep 3
$pm2 list
should 'process should has not been restarted' 'restart_time: 0' 1

$pm2 restart max-mem.json

sleep 3
$pm2 list
should 'process should has not been restarted' 'restart_time: 1' 0

$pm2 delete all

CURRENT_YEAR=`date +"%Y"`

>echo-test.log

$pm2 start echo-pre.json
sleep 2

grep $CURRENT_YEAR echo-test.log
spec "Should have written year in log file according to format YYYY"
grep "SUSU" echo-test.log
spec "Should have written new string depending on ECHO_MSG"

$pm2 restart echo-post.json
>echo-test.log

grep $CURRENT_YEAR echo-test.log
ispec "Should have not written year in log file according to format"

grep "YAY" echo-test.log
spec "Should have written new string depending on ECHO_MSG"

# Switch to production environment
$pm2 restart echo-post.json --env production
>echo-test.log

sleep 0.2

grep "WOW" echo-test.log
spec "Should have written new string depending on ECHO_MSG"

# Go back to original environment

$pm2 restart echo-post.json
sleep 0.2
grep "YAY" echo-test.log
spec "Should have written new string depending on ECHO_MSG"
