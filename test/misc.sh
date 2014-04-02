#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

cd $file_path

echo -e "\033[1mRunning tests:\033[0m"


$pm2 kill

$pm2 start env.js

OUT_LOG=`$pm2 prettylist | grep -m 1 -E "pm_out_log_path:" | sed "s/.*'\([^']*\)',/\1/"`

cat /dev/null > $OUT_LOG

sleep 1

OUT=`cat $OUT_LOG | head -n 1`

if [ $OUT = "undefined" ]
then
    success "environment variable not defined"
else
    fail "environment defined ? wtf ?"
fi

$pm2 kill

$pm2 start env.json

cat /dev/null > $OUT_LOG

sleep 1

OUT=`cat $OUT_LOG | head -n 1`

if [ $OUT = "undefined" ]
then
    fail "environment variable hasnt been defined"
else
    success "environment variable successfully defined"
fi

#####################
# Watch for changes #
#####################
$pm2 kill

cp server-watch.js server-watch.bak.js

$pm2 start --watch server-watch.js

echo "setTimeout(function() { console.log('still ok') })" >> "server-watch.js"

for (( i = 0; i <= 50; i++ )); do
    sleep 0.1
    echo -n "."
done

echo ""

should 'process should have been restarted' 'restart_time: 1' 1

$pm2 stop server-watch

mv server-watch.bak.js server-watch.js

###############
$pm2 kill

# Script should fail but be started again on next change
cp server-watch.js server-watch.bak.js

$pm2 start --watch server-watch.js
												
echo "setTimeout(function() { process.exit() }, 0)" >> "server-watch.js"

for (( i = 0; i <= 50; i++ )); do
    sleep 0.2
    echo -n "."
done

#should 'should has been deleted process by id' "status: 'errored'" 1
$pm2 list
should 'should have stopped unstable process' 'errored' 1

mv server-watch.bak.js server-watch.js

for (( i = 0; i <= 50; i++ )); do
    sleep 0.1
    echo -n "."
done

echo ""

should 'should start the errored process again while putting file back' 'online' 1
$pm2 list

$pm2 kill
