#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"
cd $file_path

echo -e "\033[1mENV REFRESH\033[0m"

#
# REFRESH with Restart via CLI
#
TEST_VARIABLE='hello1' $pm2 start env.js -o out-env.log --merge-logs --name "env"
>out-env.log

sleep 0.5
grep "hello1" out-env.log &> /dev/null
spec "should contain env variable"

TEST_VARIABLE='89hello89' $pm2 restart env --update-env

sleep 1.0
grep "89hello89" out-env.log &> /dev/null
spec "should contain refreshed environment variable"

>out-env.log
TEST_VARIABLE="CLUNEWSTER" $pm2 restart env
sleep 0.5
grep "89hello89" out-env.log &> /dev/null
spec "should not change environment (--skip-env)"

$pm2 delete all

#
# Cluster mode
#
>out-env.log
$pm2 start env.js -o out-env.log --merge-logs
sleep 1
grep "undefined" out-env.log &> /dev/null
spec "should contain nothing"

>out-env.log
TEST_VARIABLE="CLUSTER" $pm2 reload env --update-env
sleep 1
grep "CLUSTER" out-env.log &> /dev/null
spec "should contain CLUSTER"

>out-env.log
TEST_VARIABLE="CLUNEWSTER" $pm2 reload env
sleep 1
grep "CLUSTER" out-env.log &> /dev/null
spec "should contain not change environment (--skip-env)"

#
# REFRESH with Restart via JSON
#

$pm2 start env.json
>out-env.log

sleep 0.5
grep "YES" out-env.log &> /dev/null
spec "should contain env variable"


$pm2 restart env-refreshed.json
>out-env.log

sleep 0.5
grep '{"HEYYYY":true}' out-env.log &> /dev/null
spec "should contain refreshed env variable via json"


$pm2 start env-ecosystem.json --env production
>out-env.log

sleep 0.5
grep "No worries!" out-env.log &> /dev/null
spec "should use deploy.production.env.TEST_VARIABLE"


$pm2 kill
$pm2 l
NODE_PATH='/test' $pm2 start local_require.js
should 'should have loaded the right globalPaths' 'restart_time: 0' 1

$pm2 kill
$pm2 l
NODE_PATH='/test2' $pm2 start local_require.js -i 1
should 'should have loaded the right globalPaths' 'restart_time: 0' 1

#
# Ensuring that environment update works correctly when reloading with JSON config.
#
# Related issue:
# https://github.com/Unitech/pm2/issues/3192
#

# start with config
SH=shell_initial SH_PM=shell_initial $pm2 start update-env.config.js --env initial
>out-env.log

sleep 0.5
grep "SH=shell_initial PM=pm2_initial SH_PM=pm2_initial" out-env.log &> /dev/null
spec "should inject shell environment, then inject config environment on start with config"

# restart config without --update-env
$pm2 delete all
SH=shell_initial SH_PM=shell_initial $pm2 start update-env.config.js --env initial
SH=shell_updated SH_PM=shell_updated $pm2 restart update-env.config.js --env updated
>out-env.log

sleep 0.5
grep "SH=shell_updated PM=pm2_updated SH_PM=pm2_updated" out-env.log &> /dev/null
spec "should inject shell environment, then inject config environment on restart with config and without --update-env option"

# reload config without --update-env
$pm2 delete all
SH=shell_initial SH_PM=shell_initial $pm2 start update-env.config.js --env initial
SH=shell_updated SH_PM=shell_updated $pm2 reload update-env.config.js --env updated
>out-env.log

sleep 0.5
grep "SH=shell_updated PM=pm2_updated SH_PM=pm2_updated" out-env.log &> /dev/null
spec "should inject shell environment, then inject config environment on reload with config and without --update-env option"

# restart config with --update-env
$pm2 delete all
SH=shell_initial SH_PM=shell_initial $pm2 start update-env.config.js --env initial
SH=shell_updated SH_PM=shell_updated $pm2 restart update-env.config.js --env updated --update-env
>out-env.log

sleep 0.5
grep "SH=shell_updated PM=pm2_updated SH_PM=pm2_updated" out-env.log &> /dev/null
spec "should inject shell environment, then inject config environment on restart with config and with --update-env option"

# reload config with --update-env
$pm2 delete all
SH=shell_initial SH_PM=shell_initial $pm2 start update-env.config.js --env initial
SH=shell_updated SH_PM=shell_updated $pm2 reload update-env.config.js --env updated --update-env
>out-env.log

sleep 0.5
grep "SH=shell_updated PM=pm2_updated SH_PM=pm2_updated" out-env.log &> /dev/null
spec "should inject shell environment, then inject config environment on reload with config and with --update-env option"

# restart pid without --update-env
$pm2 delete all
SH=shell_initial SH_PM=shell_initial $pm2 start update-env.config.js --env initial
SH=shell_updated SH_PM=shell_updated $pm2 restart update_env_app
>out-env.log

sleep 0.5
grep "SH=shell_initial PM=pm2_initial SH_PM=pm2_initial" out-env.log &> /dev/null
spec "should keep environment on restart with pid and without --update-env option"

# reload pid without --update-env
$pm2 delete all
SH=shell_initial SH_PM=shell_initial $pm2 start update-env.config.js --env initial
SH=shell_updated SH_PM=shell_updated $pm2 reload update_env_app
>out-env.log

sleep 0.5
grep "SH=shell_initial PM=pm2_initial SH_PM=pm2_initial" out-env.log &> /dev/null
spec "should keep environment on reload with pid and without --update-env option"

# restart pid with --update-env
$pm2 delete all
SH=shell_initial SH_PM=shell_initial $pm2 start update-env.config.js --env initial
SH=shell_updated SH_PM=shell_updated $pm2 restart update_env_app --update-env
>out-env.log

sleep 0.5
grep "SH=shell_updated PM=pm2_initial SH_PM=shell_updated" out-env.log &> /dev/null
spec "should inject shell environment on restart with pid and with --update-env option"

# reload pid with --update-env
$pm2 delete all
SH=shell_initial SH_PM=shell_initial $pm2 start update-env.config.js --env initial
SH=shell_updated SH_PM=shell_updated $pm2 reload update_env_app --update-env
>out-env.log

sleep 0.5
grep "SH=shell_updated PM=pm2_initial SH_PM=shell_updated" out-env.log &> /dev/null
spec "should inject shell environment on reload with pid and with --update-env option"
