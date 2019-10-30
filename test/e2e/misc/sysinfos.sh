#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

$pm2 sysinfos
ispec "Should system monitoring be not launched"

$pm2 sysmonit
spec "should start system monitoring"

sleep 1

$pm2 sysinfos > /dev/null
spec "should show monit infos"

$pm2 set pm2:sysmonit true
spec "should set monit autospawn"

$pm2 update
sleep 1

$pm2 sysinfos > /dev/null
spec "should show monit infos"

$pm2 set pm2:sysmonit false
spec "should disable monit autospawn"
