#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

echo -e "\033[1mRunning tests:\033[0m"

cd $file_path

#
# Testing pm2 execution of binary files
#
$pm2 start `which watch` -- ls

OUT=`$pm2 prettylist | grep exec_interpreter | sed "s/[\'|,|:]//g" | awk -F' ' '{print $2}'`
[ $OUT = "none" ] || fail "$1"
success "$1"

$pm2 kill
$pm2 start binary-js-file

OUT=`$pm2 prettylist | grep exec_interpreter | sed "s/[\'|,|:]//g" | awk -F' ' '{print $2}'`
[ $OUT = "node" ] || fail "$1"
success "$1"

$pm2 kill
$pm2 start binary-js-file.js

OUT=`$pm2 prettylist | grep exec_interpreter | sed "s/[\'|,|:]//g" | awk -F' ' '{print $2}'`
[ $OUT = "node" ] || fail "$1"
success "$1"

$pm2 kill
$pm2 start binary-py-file.py

OUT=`$pm2 prettylist | grep exec_interpreter | sed "s/[\'|,|:]//g" | awk -F' ' '{print $2}'`
[ $OUT = "python" ] || fail "$1"
success "$1"

$pm2 kill
