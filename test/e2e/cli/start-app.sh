#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path/start-app

#
# Direct command
#
$pm2 delete all

if [ "$IS_BUN" = true ]; then
    $pm2 start "bun -e 'setTimeout(function() { }, 100000); console.log(process.env.TEST)'" -l test.log --merge-logs
else
    $pm2 start "node -e 'setTimeout(function() { }, 100000); console.log(process.env.TEST)'" -l test.log --merge-logs
fi

should 'should have started command' 'online' 1
should 'should have not been restarted' 'restart_time: 0' 1

cat test.log | grep "undefined" &> /dev/null
sleep 1
spec "should have printed undefined env var"

TEST='ok' $pm2 restart 0 --update-env
cat test.log | grep "ok" &> /dev/null

sleep 1
should 'should have started command' 'online' 1
should 'should have not been restarted' 'restart_time: 1' 1
spec "should have printed undefined env var"

#
# Direct command via Conf file
#
$pm2 delete all

if [ "$IS_BUN" = true ]; then
    $pm2 start ecosystem-bun.config.js
else
    $pm2 start ecosystem.config.js
fi

should 'should have started command' 'online' 1
should 'should have not been restarted' 'restart_time: 0' 1
cat test-conf.log | grep "test_val" 2> /dev/null
spec "should have printed the test_val"

#
# Compile C Program
#
cd $file_path/c-compile
$pm2 start "cc hello.c; ./a.out" -l c-log.log --merge-logs
sleep 2
cat c-log.log | grep "Hello World" &> /dev/null
spec "should have printed compiled output"
