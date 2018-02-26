#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path

$pm2 link xxx aaa

$pm2 start http.js -i 4
spec "should start 4 processes"

$pm2 monitor 0
should 'should monitoring flag enabled (id)' '_km_monitored: true' 1

$pm2 unmonitor 0
should 'should monitoring flag disabled (id)' '_km_monitored: false' 1

$pm2 monitor http
should 'should monitoring flag enabled (name)' '_km_monitored: true' 4

$pm2 unmonitor http
should 'should monitoring flag disabled (name)' '_km_monitored: false' 4

$pm2 monitor all
should 'should monitoring flag enabled ' '_km_monitored: true' 4

$pm2 unmonitor all
should 'should monitoring flag disabled (name)' '_km_monitored: false' 4
