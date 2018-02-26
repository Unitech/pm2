#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"
cd $file_path

$pm2 start echo.js -i 4
spec "should start 4 processes"
should 'should have 4 apps started' 'online' 4

$pm2 save
$pm2 resurrect
spec "should resurrect from dump"
should 'should have still 4 apps started' 'online' 4

$pm2 save
$pm2 delete all
echo "[{" > ~/.pm2/dump.pm2
$pm2 resurrect
spec "should resurrect from backup if dump is broken"
ls ~/.pm2/dump.pm2
ispec "should delete broken dump"
should 'should have still 4 apps started' 'online' 4

$pm2 delete all
$pm2 resurrect
spec "should resurrect from backup if dump is missing"
should 'should have still 4 apps started' 'online' 4
