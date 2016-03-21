#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

cd $file_path

echo -e "\033[1mRunning tests:\033[0m"

#
# Fork mode
#
rm sm.log
$pm2 start source-map/main.js -e sm.log --merge-logs --disable-source-map-support
sleep 1
cat sm.log | grep "main.js"
spec "should not take source map into account"

rm sm.log
$pm2 delete all
$pm2 start source-map/main.js -e sm.log --merge-logs
sleep 1.5
cat sm.log | grep "main.ts"
spec "should automatically activate source map support (detect main.ts)"

rm sm.log
$pm2 delete all
$pm2 start source-map/main.js -e sm.log --merge-logs --source-map-support
sleep 1
cat sm.log | grep "main.ts"
spec "should force source map support"

#
# Cluster mode
#
rm sm.log
$pm2 delete all
$pm2 start source-map/main.js -e sm.log --merge-logs -i 1
sleep 1
cat sm.log | grep "main.ts"
spec "should automatically activate source map support (detect main.ts)"

rm sm.log
$pm2 delete all
$pm2 start source-map/main.js -e sm.log --merge-logs -i 1 --source-map-support
sleep 1
cat sm.log | grep "main.ts"
spec "should force source map support"
