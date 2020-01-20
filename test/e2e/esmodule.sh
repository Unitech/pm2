#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

# Bootstrap one app
cd $file_path/esmodules/mjs

#### FORK MODE

$pm2 delete all

$pm2 start index.mjs
sleep 2
should 'should have detected es module via .mjs file extension and started 1 app' 'online' 1
should 'should have application in stable state' 'restart_time: 0' 1

$pm2 restart index
sleep 2
should 'should have detected es module via .mjs file extension and started 1 app' 'online' 1
should 'should have application in stable state' 'restart_time: 1' 1

$pm2 delete all

cd $file_path/esmodules/packagemodule

$pm2 start index.js
sleep 2
should 'should have detected es module via .mjs file extension and started 1 app' 'online' 1
should 'should have application in stable state' 'restart_time: 0' 1

$pm2 restart index
sleep 2
should 'should have detected es module via .mjs file extension and started 1 app' 'online' 1
should 'should have application in stable state' 'restart_time: 1' 1

$pm2 save

$pm2 update

sleep 2
should 'should have detected es module via .mjs file extension and started 1 app' 'online' 1
should 'should have application in stable state' 'restart_time: 0' 1

#### CLUSTER MODE

cd $file_path/esmodules/mjs

$pm2 delete all

$pm2 start index.mjs -i 4
sleep 2
should 'should have detected es module via .mjs file extension and started 4 apps' 'online' 4
should 'should have application in stable state' 'restart_time: 0' 4

$pm2 restart index
sleep 2
should 'should have detected es module via .mjs file extension and started 4 app' 'online' 4
should 'should have application in stable state' 'restart_time: 1' 4

$pm2 delete all

cd $file_path/esmodules/packagemodule

$pm2 start index.js -i 4
sleep 2
should 'should have detected es module via .mjs file extension and started 4 apps' 'online' 4
should 'should have application in stable state' 'restart_time: 0' 4

$pm2 restart index
sleep 2
should 'should have detected es module via .mjs file extension and started 4 app' 'online' 4
should 'should have application in stable state' 'restart_time: 1' 4

$pm2 delete all
