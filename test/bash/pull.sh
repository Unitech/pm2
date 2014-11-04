B1;2802;0c#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

echo -e "\033[1mRunning tests:\033[0m"

cd $file_path

#
# Testing pull,forward,backward methods
#
git clone https://github.com/Unitech/angular-bridge.git
$pm2 start ./angular-bridge/index.js --name angular

OUT=`$pm2 desc 0 | grep remote | egrep -oh 'https://([^ ]+)'`
[ $OUT = "https://github.com/Unitech/angular-bridge.git" ] || fail "$1"
success "$1"

OUT=`$pm2 backward angular | wc -l`
[ $OUT -eq 13 ] || fail "$1"
success "$1"

OUT=`$pm2 forward angular | wc -l`
[ $OUT -eq 13 ] || fail "$1"
success "$1"

OUT=`$pm2 forward angular | wc -l`
[ $OUT -eq 2 ] || fail "$1"
success "$1"

OUT=`$pm2 pull angular | wc -l`
[ $OUT -eq 2 ] || fail "$1"
success "$1"

$pm2 kill
rm -rf ./angular-bridge
