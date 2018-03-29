#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"
cd $file_path

$pm2 start echo.js -i 4
spec "should start 4 processes"
should 'should have 4 apps started' 'online' 4

rm -f ~/.pm2/dump.pm2 ~/.pm2/dump.pm2.bak
$pm2 save
spec "should save process list"
ls ~/.pm2/dump.pm2
spec "dump file should exist"
ls ~/.pm2/dump.pm2.bak
ispec "dump backup file should not exist"

$pm2 save
spec "should save and backup process list"
ls ~/.pm2/dump.pm2
spec "dump file should exist"
ls ~/.pm2/dump.pm2.bak
spec "dump backup file should exist"
