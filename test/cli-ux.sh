#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"


echo -e "\033[1mRunning tests:\033[0m"

which wrk
spec "You should have wrk benchmark in your /usr/bin"

killall node

cd $file_path
$pm2 start cluster-pm2.json
$pm2 start cluster-pm2.json -f
$pm2 start cluster-pm2.json -f
$pm2 start cluster-pm2.json -f
spec "start cluster"

wrk -c 500 -t 500 -d 8 http://localhost:8020 &> /dev/null &
$pm2 monit
$pm2 list
$pm2 stop
