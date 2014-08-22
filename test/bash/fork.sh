#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

cd $file_path

########### Fork mode
$pm2 start echo.js -x
should 'should has forked app' 'fork_mode' 1

$pm2 restart echo.js
should 'should has forked app' 'restart_time: 1' 1

########### Fork mode
$pm2 kill

$pm2 start bashscript.sh -x --interpreter bash
should 'should has forked app' 'fork_mode' 1

########### Auto Detective Interpreter In Fork mode

$pm2 kill

$pm2 start echo.coffee -x --interpreter coffee
should 'should has forked app' 'fork_mode' 1

### Dump resurrect should be ok
$pm2 dump

$pm2 kill

#should 'should has forked app' 'fork' 0

$pm2 resurrect
should 'should has forked app' 'fork_mode' 1

## Delete

$pm2 list

$pm2 delete 0
should 'should has delete process' 'fork_mode' 0
