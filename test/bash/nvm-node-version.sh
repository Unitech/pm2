#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

echo -e "\033[1mRunning tests:\033[0m"

cd $file_path/nvm-node-version

function getInterpreter() {
	echo `$pm2 prettylist | grep "exec_interpreter:" | awk -F"'" '{print $2}'`
}


$pm2 start ecosystem.json
sleep 1

OCC=$($pm2 prettylist | grep "exec_interpreter" | grep 'v4.6.0\|v6.7.0' | wc -l)

[ $OCC -eq 2 ] || fail "Errors in setting interpreters"
success "Success"
