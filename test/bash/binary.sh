#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

echo -e "\033[1mRunning tests:\033[0m"

cd $file_path

function getInterpreter() {
	echo `$pm2 prettylist | grep exec_interpreter | awk -F"'" '{print $2}'`
}

#
# Testing pm2 execution of binary files
#
$pm2 start `which watch` -- ls

OUT=$(getInterpreter)
[ $OUT="none" ] || fail "$1"
success "$1"

$pm2 kill
$pm2 start binary-js-file

OUT=$(getInterpreter)
[ $OUT="node" ] || fail "$1"
success "$1"

$pm2 kill
$pm2 start binary-js-file.js

OUT=$(getInterpreter)
[ $OUT="node" ] || fail "$1"
success "$1"

$pm2 kill
$pm2 start binary-py-file.py

OUT=$(getInterpreter)
[ $OUT="python" ] || fail "$1"
success "$1"

$pm2 kill
