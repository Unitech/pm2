#!/usr/bin/env bash
#
# PM2 test runner for Windows (Git Bash)
# Runs unit tests and Windows-compatible e2e tests
#
# Usage:
#   bash test/windows.sh
#

cd "$(dirname "$0")/.."

export PM2_SILENT="true"

mocha="npx mocha"
pm2="$(pwd)/bin/pm2"

# ==================== UNIT TESTS ====================

function reset {
    $pm2 uninstall all -s 2>/dev/null
    $pm2 link delete -s 2>/dev/null
    $pm2 kill -s 2>/dev/null
}

function runUnitTest {
    echo "[~] Starting unit test $1"
    reset
    $mocha --exit --bail "$1"
    RET=$?

    if [ $RET -ne 0 ]; then
        echo "[RETRY] $1 failed, retrying..."
        reset
        $mocha --bail --exit "$1"
        RET=$?

        if [ $RET -ne 0 ]; then
            echo "######## TEST FAILED: $1"
            UNIT_FAILED=1
        fi
    fi

    reset
}

UNIT_FAILED=0

reset

D=test/programmatic

runUnitTest $D/path_resolution.mocha.js
runUnitTest $D/modules.mocha.js
runUnitTest $D/instances.mocha.js
runUnitTest $D/reload-locker.mocha.js
runUnitTest $D/filter_env.mocha.js
runUnitTest $D/resurect_state.mocha.js
runUnitTest $D/programmatic.js
runUnitTest $D/namespace.mocha.js
runUnitTest $D/auto_restart.mocha.js
runUnitTest $D/containerizer.mocha.js
runUnitTest $D/api.mocha.js
# Excluded: lazy_api.mocha.js - timing-dependent, flaky on Windows CI
# Excluded: exp_backoff_restart_delay.mocha.js - timing-dependent exponential backoff test
runUnitTest $D/api.backward.compatibility.mocha.js
runUnitTest $D/custom_action.mocha.js
runUnitTest $D/logs.js
runUnitTest $D/watcher.js
runUnitTest $D/max_memory_limit.js
runUnitTest $D/cluster.mocha.js
runUnitTest $D/graceful.mocha.js
runUnitTest $D/inside.mocha.js
runUnitTest $D/misc_commands.js
# Excluded: signals.js - SIGINT delivery doesn't trigger JS signal handlers on Windows
runUnitTest $D/send_data_process.mocha.js
runUnitTest $D/json_validation.mocha.js
runUnitTest $D/env_switching.js
runUnitTest $D/configuration.mocha.js
runUnitTest $D/id.mocha.js
runUnitTest $D/god.mocha.js
runUnitTest $D/dump.mocha.js
runUnitTest $D/common.mocha.js
runUnitTest $D/fclone.mocha.js
runUnitTest $D/issues/json_env_passing_4080.mocha.js
runUnitTest $D/issue_6106_windows_home.mocha.js

D=test/interface

runUnitTest $D/bus.spec.mocha.js
runUnitTest $D/bus.fork.spec.mocha.js
runUnitTest $D/utility.mocha.js

echo "============== unit tests finished =============="

# E2E tests skipped on Windows — bash scripts rely on Unix shell semantics
# (inline shell commands, /bin/sh, /tmp/, single quotes, signal handling, etc.)
# E2E coverage is provided by the Linux CI jobs.

# ==================== SMOKE TEST ====================
# Verify the pm2 binary initializes correctly (shebang + basic commands)

echo "[~] Starting smoke test: pm2 binary"

$pm2 --version > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "######## ✘ pm2 --version failed"
    exit 1
fi
echo "------------> ✔ pm2 --version"

$pm2 ls > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "######## ✘ pm2 ls failed"
    exit 1
fi
echo "------------> ✔ pm2 ls"

$pm2 start test/fixtures/child.js --name smoke-test > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "######## ✘ pm2 start failed"
    exit 1
fi
echo "------------> ✔ pm2 start"

$pm2 prettylist | grep -q "online"
if [ $? -ne 0 ]; then
    echo "######## ✘ process not online"
    exit 1
fi
echo "------------> ✔ process is online"

$pm2 delete all > /dev/null 2>&1
$pm2 kill > /dev/null 2>&1
echo "------------> ✔ pm2 cleanup"

echo "============== smoke test passed =============="

# Final result
if [ $UNIT_FAILED -ne 0 ]; then
    echo "SOME UNIT TESTS FAILED"
    exit 1
fi

echo "ALL TESTS PASSED"
