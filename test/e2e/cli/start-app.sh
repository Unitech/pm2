#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

echo -e "\033[1mRunning tests:\033[0m"

cd $file_path/start-app

#
# Direct command
#
$pm2 delete all

$pm2 start "node -e 'setTimeout(function() { }, 100000); console.log(process.env.TEST)'" -l test.log --merge-logs
should 'should have started command' 'online' 1
should 'should have not been restarted' 'restart_time: 0' 1

cat test.log | grep "undefined"
spec "should have printed undefined env var"

TEST='ok' $pm2 restart 0 --update-env
cat test.log | grep "ok"

should 'should have started command' 'online' 1
should 'should have not been restarted' 'restart_time: 1' 1
spec "should have printed undefined env var"

#
# Direct command via Conf file
#
$pm2 delete all

$pm2 start ecosystem.config.js
should 'should have started command' 'online' 1
should 'should have not been restarted' 'restart_time: 0' 1
cat test-conf.log | grep "test_val"
spec "should have printed the test_val"
