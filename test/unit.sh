#!/usr/bin/env bash

alias mocha='../node_modules/mocha/bin/mocha'
pm2="`type -P node` `pwd`/bin/pm2"

function reset {
    $pm2 uninstall all -s
    $pm2 link delete -s
    $pm2 kill -s
}

function runUnitTest {
    echo "[~] Starting test $1"
    START=$(date +%s)
    mocha --exit --bail --opts ./mocha.opts $1
    RET=$?

    if [ $RET -ne 0 ];
    then
        STR="[RETRY] $1 failed and NOW is getting retried"
        echo $STR
        echo $STR >> unit_time

        reset
        mocha --bail --exit --opts ./mocha.opts $1
        RET=$?

        if [ $RET -ne 0 ];
        then
            echo -e "######## TEST ✘ $1 FAILED TWICE!!"
            exit 1
        fi
    fi

    reset

    END=$(date +%s)
    DIFF=$(echo "$END - $START" | bc)
    STR="[V] $1 succeeded and took $DIFF seconds"
    echo $STR
    echo $STR >> unit_time
}

reset

touch unit_time
> unit_time

cd test/programmatic


# Abort script at first error
# set -e

runUnitTest ./programmatic.js
runUnitTest ./instances.mocha.js
runUnitTest ./containerizer.mocha.js
runUnitTest ./api.mocha.js
runUnitTest ./path_resolution.mocha.js
runUnitTest ./lazy_api.mocha.js
runUnitTest ./reload-locker.mocha.js
runUnitTest ./auto_restart.mocha.js
runUnitTest ./version.mocha.js
runUnitTest ./exp_backoff_restart_delay.mocha.js
runUnitTest ./internal_config.mocha.js
runUnitTest ./api.backward.compatibility.mocha.js
runUnitTest ./custom_action.mocha.js
runUnitTest ./logs.js
runUnitTest ./watcher.js
runUnitTest ./max_memory_limit.js
runUnitTest ./cluster.mocha.js
runUnitTest ./graceful.mocha.js
runUnitTest ./inside.mocha.js
runUnitTest ./misc_commands.js
runUnitTest ./signals.js
runUnitTest ./send_data_process.mocha.js
runUnitTest ./modules.mocha.js
runUnitTest ./json_validation.mocha.js
runUnitTest ./env_switching.js
runUnitTest ./configuration.mocha.js
runUnitTest ./id.mocha.js
runUnitTest ./god.mocha.js

runUnitTest ./issues/json_env_passing_4080.mocha.js

cd ../interface

runUnitTest ./bus.spec.mocha.js
runUnitTest ./bus.fork.spec.mocha.js
runUnitTest ./utility.mocha.js

echo "============== unit test finished =============="
cat unit_time
