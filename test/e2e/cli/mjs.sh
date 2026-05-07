#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path/mjs

$pm2 start --node-args="--experimental-modules" index.mjs -o outech.log -e errech.log
>outech.log
>errech.log
sleep 2
should 'should app be online in fork mode with MJS support' 'online' 1

$pm2 delete all

$pm2 start --node-args="--experimental-modules" -i 2 index.mjs
sleep 2
should 'should app be online in cluster mode with MJS support' 'online' 2
