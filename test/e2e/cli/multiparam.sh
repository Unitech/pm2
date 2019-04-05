#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path

## Start
$pm2 start child.js echo.js server.js
should 'should app be online' 'online' 3

## Restart
$pm2 restart child echo server
should 'should app be online' 'online' 3
should 'should all script been restarted one time' 'restart_time: 1' 3

## Stop
$pm2 stop child echo server
should 'should app be stopped' 'stopped' 3

## Delete
$pm2 delete child echo server
shouldnot 'should app be deleted' 'stopped' 3
