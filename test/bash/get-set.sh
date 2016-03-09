#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

cd $file_path

$pm2 unset all
spec "Should unset all variables"

ls ~/.pm2/module_conf.json
spec "Should file exists"

$pm2 set key1 val1
cat ~/.pm2/module_conf.json | grep "key1"
spec "Should key exists"

$pm2 unset key1
cat ~/.pm2/module_conf.json | grep "key1"
ispec "Should key not exists"
