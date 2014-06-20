#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

cd $file_path
$pm2 kill

echo "################ HARMONY ES6"

$pm2 start harmony.js
sleep 8
$pm2 list
should 'should fail when trying to launch pm2 without harmony option' 'errored' 1
$pm2 list
$pm2 kill

PM2_NODE_OPTIONS='--harmony' `pwd`/../../bin/pm2 start harmony.js
sleep 2
should 'should not fail when passing harmony option to V8' 'errored' 0
$pm2 list
$pm2 kill


$pm2 start harmony.js --node-args="--harmony"
sleep 8
$pm2 list
should 'should not fail when passing node-args=harmony opts' 'errored' 0
$pm2 list
$pm2 kill
