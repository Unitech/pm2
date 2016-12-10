#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"
cd $file_path

$pm2 start echo.js -i 4
spec "should start 4 processes"
$pm2 save
spec "should save process list"
ls ~/.pm2/dump.pm2
spec "should dump file exists"
$pm2 resurrect
spec "should resurrect"
should 'should have still 4 apps started' 'online' 4
$pm2 delete all
$pm2 resurrect
should 'should have still 4 apps started' 'online' 4
