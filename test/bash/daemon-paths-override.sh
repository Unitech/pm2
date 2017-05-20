#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

$pm2 kill

########### Override PM2 log path
PM2_LOG_FILE_PATH=/tmp/.toto.log $pm2 ls

test -f /tmp/.toto.log 

spec 'should have picked the pm2 log path'

$pm2 kill
rm /tmp/.toto.log

########### Override PM2 pid path
PM2_PID_FILE_PATH=/tmp/.toto.pid $pm2 ls

! test -f /tmp/.toto.log 
test -f /tmp/.toto.pid 

spec 'should have picked the pm2 pid path'

$pm2 kill

sleep 2

! test -f /tmp/.toto.pid 
! test -f /tmp/.toto.log

spec 'should have deleted pm2 pid file in custom path'