#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path

#
# Fork mode
#
rm sm.log
$pm2 start source-map/main.js -e sm.log --merge-logs --disable-source-map-support
sleep 2
cat sm.log | grep "main.js"
spec "should not take source map into account"

rm sm.log
$pm2 delete all
$pm2 start source-map/main.js -e sm.log --merge-logs
sleep 2
cat sm.log | grep "main.ts"
spec "should automatically activate source map support (detect main.ts)"

rm sm.log
$pm2 delete all
$pm2 start source-map/main.js -e sm.log --merge-logs --source-map-support
sleep 2
cat sm.log | grep "main.ts"
spec "should force source map support"

#
# Cluster mode
#
rm sm.log
$pm2 delete all
$pm2 start source-map/main.js -e sm.log --merge-logs -i 1
sleep 2
cat sm.log | grep "main.ts"
spec "should automatically activate source map support (detect main.ts)"

rm sm.log
$pm2 delete all
$pm2 start source-map/main.js -e sm.log --merge-logs -i 1 --source-map-support
sleep 2
cat sm.log | grep "main.ts"
spec "should force source map support"
