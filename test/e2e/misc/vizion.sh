#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path

echo "################## VIZION ###################"

mv git .git

###############
$pm2 kill
$pm2 start echo.js
sleep 1

should 'should have versioning metadata' 'jshkurti/pm2_travis' 1

$pm2 delete all
$pm2 start echo.js --no-vizion
sleep 1

should 'should not have versioning metadata' 'jshkurti/pm2_travis' 0

$pm2 delete all
$pm2 start no-vizion.json
sleep 1

should 'should not have versioning metadata' 'jshkurti/pm2_travis' 0

mv .git git
