#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"


pm2_path=`pwd`/bin/pm2-dev

if [ ! -f $pm2_path ];
then
    pm2_path=`pwd`/../bin/pm2-dev
    if [ ! -f $pm2_path ];
    then
        pm2_path=`pwd`/../../bin/pm2-dev
    fi
fi

pm2dev="`type -P node` $pm2_path"

export PM2_HOME=$HOME'/.pm2-dev'

cd $file_path/pm2-dev

# Test with js
$pm2dev app.js --test-mode
$pm2 ls
should 'should have started 1 apps' 'online' 1
should 'should watch be true' 'watch: true' 1
$pm2 kill

# Test with json and args
$pm2dev start app.json --test-mode
$pm2 ls
should 'should have started 1 apps' 'online' 1
$pm2 prettylist | grep "watch: \[ 'server', 'client' \]"
spec "Should application have two watch arguments"
$pm2 prettylist | grep "ignore_watch: \[ 'node_modules', 'client/img' \]"
spec "Should application have two ignore_watch arguments"
$pm2 kill
