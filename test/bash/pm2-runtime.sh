#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

export PM2_HOME="$HOME/.pm3"

pm2runtime="`type -P node` `pwd`/bin/pm2-runtime"

export PM2_RUNTIME_DEBUG='true'

cd $file_path/pm2-dev

$pm2 delete all

# Test with js
$pm2runtime app.js -i 4
should 'should have started 4 apps' 'online' 4

$pm2 delete all

# Test with json and args
$pm2runtime app.json
should 'should have started 1 apps' 'online' 1
$pm2 prettylist | grep "watch: \[ 'server', 'client' \]"
spec "Should application have two watch arguments"
$pm2 prettylist | grep "ignore_watch: \[ 'node_modules', 'client/img' \]"
spec "Should application have two ignore_watch arguments"
$pm2 kill
