#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path

############# TEST

cd start-consistency;

$pm2 start child.js

LINE_NB_CLI=`$pm2 prettylist | wc -l`

$pm2 delete all

$pm2 start child.json

LINE_NB_JSON=`$pm2 prettylist | wc -l`

$pm2 prettylist | grep "vizion: true"
spec "Vizion"


# if [ $LINE_NB_JSON -eq $LINE_NB_CLI ]
# then
#     success "Starting a basic JSON is consistent with CLI start"
# else
#     fail "Starting a basic JSON is NOT consistent with CLI start"
# fi
