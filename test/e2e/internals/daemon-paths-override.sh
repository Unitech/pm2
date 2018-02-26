#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

$pm2 kill
rm /tmp/.toto.pid

########### Override PM2 pid path
PM2_PID_FILE_PATH=/tmp/.toto.pid $pm2 ls

sleep 2
test -f /tmp/.toto.pid

spec 'should have picked the pm2 pid path'
