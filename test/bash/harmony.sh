#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

cd $file_path
$pm2 kill

echo "################ HARMONY ES6"

$pm2 start harmony.js
sleep 2
$pm2 list
should 'should FAIL when not passing harmony option to V8' 'restart_time: 0' 0
$pm2 list
$pm2 delete all

$pm2 start harmony.js --node-args="--harmony"
sleep 2
$pm2 list
should 'should not fail when passing node-args=harmony opts in CLUSTERMODE' 'restart_time: 0' 1
$pm2 delete all

echo "################ HARMONY / NODEARGS ES6 FORK MODE"

$pm2 start harmony.js --node-args="--harmony" -x
sleep 2
$pm2 list
should 'should not fail when passing node-args=harmony opts in FORKMODE' 'restart_time: 0' 1
$pm2 delete all

echo "################## NODE ARGS VIA JSON"

$pm2 start harmony.json
sleep 2
$pm2 list
should 'should not fail when passing harmony option to V8 via node_args in JSON files' 'restart_time: 0' 1

$pm2 delete all
