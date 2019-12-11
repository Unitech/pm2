#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

node -e "require('semver').lt(process.versions.node, '6.0.0') ? process.exit(0) : process.exit(1)"
[ $? -eq 1 ] || exit 0

cd $file_path

$pm2 unset echo
spec "Should unset echo variables"

$pm2 start echo.js --name "echo"
should 'should app be online' 'online' 1

should 'should not have config variable' "config_var: 'false'" 0

$pm2 set echo.config_var false

exists 'should NOW have config variable' "config_var: 'false'"

$pm2 set echo.probes true

exists 'should NOW have config variable' "probes: 'true'"
should 'should have start 3 apps' 'restart_time: 2' 1

$pm2 multiset "echo.conf false"

exists 'should NOW have config variable' "conf: 'false'"
should 'should have start 3 apps' 'restart_time: 3' 1

# $pm2 get echo.config_var | grep "false"
# spec "Should get method work"

# $pm2 get echo | grep "false\|true"
# spec "Should get method work"

# $pm2 conf echo.config_var | grep "false"
# spec "Should conf method work"

# $pm2 conf echo | grep "false\|true"
# spec "Should get method work"

$pm2 delete all

#
#
#
#

$pm2 unset "probe-test"
$pm2 start probes.js --name "probe-test"

echo "Wait for init..."

sleep 3

exists 'probe test-probe exist' "test-probe"
exists 'probe Event Loop Latency exist' "Event Loop Latency p95"

# Set new value for alert probe
# $pm2 set probe-test.probes.Event\ Loop\ Latency.value 25
# sleep 1

# exists 'probe Event Loop Latency alerted' "alert: { cmp: '>', value: 25, mode: 'threshold'"

# Override value for test-probe
# $pm2 set probe-test.probes.test-probe.value 30
# sleep 1
