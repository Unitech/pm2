#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

pm2dev="`type -P node` `pwd`/bin/pm2-dev"
rundev="`type -P node` `pwd`/bin/rundev"

export PM2_HOME=$HOME'/.pm2-dev'

$pm2 flush

$rundev start test/fixtures/child.js --test-mode

$pm2 ls
should 'should have started 1 apps' 'online' 1
echo "Change bomb" > test/fixtures/change
rm test/fixtures/change
sleep 1
should 'should has restarted process' 'restart_time: 1' 1
$pm2 kill
