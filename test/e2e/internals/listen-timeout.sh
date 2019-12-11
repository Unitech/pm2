#!/usr/bin/env bash

#export PM2_GRACEFUL_LISTEN_TIMEOUT=1000

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"
cd $file_path/listen-timeout/

echo -e "\033[1mENV REFRESH\033[0m"

$pm2 start wait-ready.js -i 1 --wait-ready --listen-timeout 5000

$pm2 reload all &
sleep 2
should 'should have started 1 clustered app' 'online' 1
should 'should restart processes with new name' 'restart_time: 1' 1
