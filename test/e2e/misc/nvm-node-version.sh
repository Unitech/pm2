#!/usr/bin/env bash

echo "feature in deprecation"
exit 0

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path/nvm-node-version

function getInterpreter() {
	echo `$pm2 prettylist | grep "exec_interpreter:" | awk -F"'" '{print $2}'`
}


$pm2 start ecosystem.json
sleep 1

OCC=$($pm2 prettylist | grep "exec_interpreter" | grep 'v4.6.0\|v6.7.0' | wc -l)
[ $OCC -eq 2 ] || fail "Errors in setting interpreters"
success "Success"

$pm2 restart ecosystem.json

should 'should have 2 apps online' 'online' 2
OCC=$($pm2 prettylist | grep "exec_interpreter" | grep 'v4.6.0\|v6.7.0' | wc -l)
[ $OCC -eq 2 ] || fail "Errors in setting interpreters"
success "Success"

$pm2 restart all
sleep 0.5
should 'should have 2 apps online' 'online' 2
OCC=$($pm2 prettylist | grep "exec_interpreter" | grep 'v4.6.0\|v6.7.0' | wc -l)
[ $OCC -eq 2 ] || fail "Errors in setting interpreters"
success "Success"

# Update node.js version
$pm2 restart ecosystem-change.json
OCC=$($pm2 prettylist | grep "exec_interpreter" | grep 'v4.5.0\|v6.7.0' | wc -l)
[ $OCC -eq 2 ] || fail "Errors in setting interpreters"
success "Success"

$pm2 restart all
sleep 0.5
should 'should have 2 apps online' 'online' 2
OCC=$($pm2 prettylist | grep "exec_interpreter" | grep 'v4.5.0\|v6.7.0' | wc -l)
[ $OCC -eq 2 ] || fail "Errors in setting interpreters"
success "Success"
