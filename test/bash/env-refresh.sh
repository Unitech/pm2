#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"
cd $file_path

echo -e "\033[1mENV REFRESH\033[0m"

#
# Restart via CLI
#
TEST_VARIABLE='hello1' $pm2 start env.js -o out-env.log --merge-logs --name "env"
>out-env.log

sleep 0.5
grep "hello1" out-env.log &> /dev/null
spec "should contain env variable"

TEST_VARIABLE='89hello89' $pm2 restart env

sleep 1.0
grep "89hello89" out-env.log &> /dev/null
spec "should contain refreshed environment variable"

$pm2 delete all

# HEYYYY

#
# Restart via JSON
#

$pm2 start env.json
>out-env.log

sleep 0.5
grep "YES" out-env.log &> /dev/null
spec "should contain env variable"

$pm2 restart env-refreshed.json
>out-env.log

sleep 0.5
grep "HEYYYY" out-env.log &> /dev/null
spec "should contain refreshed env variable via json"
