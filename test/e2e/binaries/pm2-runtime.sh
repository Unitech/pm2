#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"


pm2_path=`pwd`/bin/pm2-runtime

if [ ! -f $pm2_path ];
then
    pm2_path=`pwd`/../bin/pm2-runtime
    if [ ! -f $pm2_path ];
    then
        pm2_path=`pwd`/../../bin/pm2-runtime
    fi
fi

pm2_runtime="`type -P node` $pm2_path"

export PM2_RUNTIME_DEBUG='true'

cd $file_path/pm2-dev

#
# Simple start with 4 apps
#
$pm2 kill
pkill -f PM2

$pm2_runtime app.js -i 4
should 'should have started 4 apps' 'online' 4

$pm2 kill

#
# Test with json and args
#
$pm2_runtime app.json
should 'should have started 1 apps' 'online' 1
$pm2 prettylist | grep "watch: \[ 'server', 'client' \]"
spec "Should application have two watch arguments"
$pm2 prettylist | grep "ignore_watch: \[ 'node_modules', 'client/img' \]"
spec "Should application have two ignore_watch arguments"
$pm2 kill

# Restore default behavior for exit checks
unset PM2_RUNTIME_DEBUG

#
# --no-autorestart checks
#
# $pm2_runtime app.js --no-autorestart
# PID_PM2=$!
# $pm2 pid app
# echo "OK"
# PID=`cat /tmp/pid`
# echo $PID
# kill $PID
# sleep 3
# pgrep "PM2"
# ispec "PM2 runtime should be killed because no app is running"

#
# Auto Exit Worker
#
$pm2_runtime exited_app.js 2> /dev/null
sleep 1
pgrep "PM2"
ispec "PM2 runtime should be killed because no app is running"
