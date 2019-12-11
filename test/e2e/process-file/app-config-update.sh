#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

export PM2_GRACEFUL_TIMEOUT=1000
export PM2_GRACEFUL_LISTEN_TIMEOUT=1000

cd $file_path

$pm2 kill

$pm2 start app-config-update/args1.json
$pm2 prettylist | grep "node_args: \[\]"
spec "1 Should application have empty node argument list"

$pm2 restart app-config-update/args2.json
$pm2 prettylist | grep "node_args: \[ '--harmony' \]"
spec "2 Should application have one node argument"

$pm2 delete all

$pm2 start app-config-update/echo.js
$pm2 prettylist | grep "node_args: \[\]"
spec "3 Should application have empty node argument list"

$pm2 restart app-config-update/echo.js --node-args="--harmony"
$pm2 prettylist | grep "node_args: \[ '--harmony' \]"
spec "4 Should application have one node argument"

# Variation with pm2 start that restarts an app
$pm2 start echo --node-args="--harmony"
$pm2 prettylist | grep "node_args: \[ '--harmony' \]"
spec "5 Should application have one node argument"

#
# Rename
#
$pm2 restart 0 --name="new-name"
$pm2 reset all
$pm2 restart new-name
should '6 should restart processes with new name' 'restart_time: 1' 1

$pm2 start 0 --name="new-name-2"
$pm2 reset all
$pm2 restart new-name-2
should '7 should restart processes with new name' 'restart_time: 1' 1

$pm2 delete all

########## RELOAD/CLUSTER MODE #########

$pm2 start app-config-update/echo.js -i 1
$pm2 prettylist | grep "node_args: \[\]"
spec "Should application have empty node argument list"

$pm2 reload app-config-update/echo.js --node-args="--harmony"
$pm2 prettylist | grep "node_args: \[ '--harmony' \]"
spec "Should application have one node argument"

$pm2 prettylist | grep "node_args"
spec "Should have found parameter"
# Now set node-args to null
$pm2 reload app-config-update/echo.js --node-args=null
# Should not find node_args anymore
$pm2 prettylist | grep "node_args"
ispec "Should have deleted cli parameter when passing null"

$pm2 reload echo --name="new-name"
$pm2 reset all
$pm2 restart new-name
should 'should reload processes with new name' 'restart_time: 1' 1
