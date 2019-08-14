#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path

function getInterpreter() {
	echo `$pm2 prettylist | grep "exec_interpreter:" | awk -F"'" '{print $2}'`
}

#
# Testing pm2 execution of binary files
#
$pm2 start `type -p watch` -- ls

OUT=$(getInterpreter)

[ $OUT="none" ] || fail "$1"
success "$1"

$pm2 kill
$pm2 start binary-js-file

OUT=$(getInterpreter)
echo $OUT

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

#
# Should execute command in $PATH
#
$pm2 start ls
spec "Should script started"

OUT=$(getInterpreter)
[ $OUT="none" ] || fail "$1"
success "Right interpreter"

should 'Have the right relative path' '/bin/ls' 1
