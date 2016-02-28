#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

cd $file_path

echo -e "\033[1mRunning tests:\033[0m"

$pm2 kill
spec "kill daemon"

#
# Fork mode
#
rm sm.log
$pm2 start source-map/main.js -e sm.log --merge-logs
sleep 1
cat sm.log | grep "main.js"
spec "should error be located in main.js file"

rm sm.log
$pm2 delete all
$pm2 start source-map/main.js -e sm.log --merge-logs --source-map-support
sleep 1
cat sm.log | grep "main.ts"
spec "should error be located in main.ts file"

#
# Cluster mode
#
rm sm.log
$pm2 delete all
$pm2 start source-map/main.js -e sm.log --merge-logs -i 1
sleep 1
cat sm.log | grep "main.js"
spec "should error be located in main.js file"

rm sm.log
$pm2 delete all
$pm2 start source-map/main.js -e sm.log --merge-logs -i 1 --source-map-support
sleep 1
cat sm.log | grep "main.ts"
spec "should error be located in main.ts file"
