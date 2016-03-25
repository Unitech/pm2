#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

cd $file_path

$pm2 start app-config-update/args1.json
$pm2 prettylist | grep "node_args: \[\]"
spec "Should application have empty node argument list"

$pm2 restart app-config-update/args2.json
$pm2 prettylist | grep "node_args: \[ '--harmony' \]"
spec "Should application have one node argument"

$pm2 delete all

$pm2 start app-config-update/echo.js
$pm2 prettylist | grep "node_args: \[\]"
spec "Should application have empty node argument list"

$pm2 restart app-config-update/echo.js --node-args="--harmony"
$pm2 prettylist | grep "node_args: \[ '--harmony' \]"
spec "Should application have one node argument"

# Variation with pm2 start that restarts an app
$pm2 start echo --node-args="--harmony --harmony-proxies"
$pm2 prettylist | grep "node_args: \[ '--harmony', '--harmony-proxies' \]"
spec "Should application have one node argument"

#
# Rename
#
$pm2 restart 0 --name="new-name"
$pm2 reset all
$pm2 restart new-name
should 'should restart processes with new name' 'restart_time: 1' 1

$pm2 start 0 --name="new-name-2"
$pm2 reset all
$pm2 restart new-name-2
should 'should restart processes with new name' 'restart_time: 1' 1

$pm2 delete all

########## RELOAD/CLUSTER MODE #########

$pm2 start app-config-update/echo.js -i 1
$pm2 prettylist | grep "node_args: \[\]"
spec "Should application have empty node argument list"

$pm2 reload app-config-update/echo.js --node-args="--harmony"
$pm2 prettylist | grep "node_args: \[ '--harmony' \]"
spec "Should application have one node argument"

$pm2 gracefulReload app-config-update/echo.js --node-args="--harmony --harmony-proxies"
$pm2 prettylist | grep "node_args: \[ '--harmony', '--harmony-proxies' \]"
spec "Should application have two node arguments"

$pm2 reload echo --name="new-name"
$pm2 reset all
$pm2 restart new-name
should 'should reload processes with new name' 'restart_time: 1' 1

$pm2 gracefulReload new-name --name="new-name-2"
$pm2 reset all
$pm2 restart new-name-2
should 'should graceful reload processes with new name' 'restart_time: 1' 1
