#!/usr/bin/env bash

mocha="npx mocha"
pm2="`type -P node` `pwd`/bin/pm2"

function reset {
    $pm2 uninstall all -s
    $pm2 link delete -s
    $pm2 kill -s
}

function runUnitTest {
    echo "[~] Starting test $1"
    START=$(date +%s)
    $mocha --exit --bail $1
    RET=$?

    if [ $RET -ne 0 ];
    then
        STR="[RETRY] $1 failed and NOW is getting retried"
        echo $STR
        echo $STR >> unit_time

        reset
        $mocha --bail --exit $1
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

D=test/programmatic

# Abort script at first error
# set -e

runUnitTest $D/filter_env.mocha.js
runUnitTest $D/resurect_state.mocha.js
runUnitTest $D/programmatic.js
runUnitTest $D/namespace.mocha.js
runUnitTest $D/instances.mocha.js
runUnitTest $D/containerizer.mocha.js
runUnitTest $D/api.mocha.js
runUnitTest $D/path_resolution.mocha.js
runUnitTest $D/lazy_api.mocha.js
runUnitTest $D/reload-locker.mocha.js
runUnitTest $D/auto_restart.mocha.js
runUnitTest $D/version.mocha.js
runUnitTest $D/exp_backoff_restart_delay.mocha.js
runUnitTest $D/api.backward.compatibility.mocha.js
runUnitTest $D/custom_action.mocha.js
runUnitTest $D/logs.js
runUnitTest $D/watcher.js
runUnitTest $D/max_memory_limit.js
runUnitTest $D/cluster.mocha.js
runUnitTest $D/graceful.mocha.js
runUnitTest $D/inside.mocha.js
runUnitTest $D/misc_commands.js
runUnitTest $D/signals.js
runUnitTest $D/send_data_process.mocha.js
runUnitTest $D/modules.mocha.js
runUnitTest $D/json_validation.mocha.js
runUnitTest $D/env_switching.js
runUnitTest $D/configuration.mocha.js
runUnitTest $D/id.mocha.js
runUnitTest $D/god.mocha.js
runUnitTest $D/dump.mocha.js

runUnitTest $D/issues/json_env_passing_4080.mocha.js

D=test/interface

runUnitTest $D/bus.spec.mocha.js
runUnitTest $D/bus.fork.spec.mocha.js
runUnitTest $D/utility.mocha.js

echo "============== unit test finished =============="
cat unit_time
