#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

cd $file_path
$pm2 kill

echo "################ HARMONY ES6"

$pm2 start harmony.js
sleep 2
$pm2 list
ishould 'should not fail when passing harmony option to V8' 'restart_time: 0' 1
$pm2 list
$pm2 kill

PM2_NODE_OPTIONS='--harmony' `pwd`/../../bin/pm2 start harmony.js
sleep 2
$pm2 list
should 'should not fail when passing harmony option to V8' 'restart_time: 0' 1
$pm2 kill

$pm2 start harmony.js --node-args="--harmony"
sleep 2
$pm2 list
should 'should not fail when passing node-args=harmony opts' 'restart_time: 0' 1
$pm2 kill

echo "################ HARMONY / NODEARGS ES6 FORK MODE"

$pm2 start harmony.js --node-args="--harmony" -x
sleep 2
$pm2 list
should 'should not fail when passing node-args=harmony opts' 'restart_time: 0' 1
$pm2 kill


PM2_NODE_OPTIONS='--harmony' $pm2 start harmony.js -x
sleep 2
$pm2 list
should 'should not fail when passing node-args=harmony opts' 'restart_time: 0' 1
$pm2 kill
