#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path

PM2_ROOT="${PM2_HOME:-$HOME/.pm2}"
PM2_LOG="$PM2_ROOT/pm2.log"
LOGS="$PM2_ROOT/logs"

echo ">>>>>>>>>>>>>>>>>>>> CLUSTER MODE: raw fd writes and inherited children go to the app logs, not pm2.log"

rm -f $LOGS/raw-stdio-*.log
: > "$PM2_LOG"

$pm2 start raw-stdio.js -i 1 --name raw-stdio --merge-logs

sleep 2

grep -q "RAW-OUT" $LOGS/raw-stdio-out.log
spec "direct fd 1 write should be in the app out log"
grep -q "CHILD-INHERIT" $LOGS/raw-stdio-out.log
spec "stdio-inherit child output should be in the app out log"
grep -q "HOOKED-OUT" $LOGS/raw-stdio-out.log
spec "console.log should still be in the app out log"
grep -q "RAW-ERR" $LOGS/raw-stdio-error.log
spec "direct fd 2 write should be in the app error log"

! grep -q "RAW-OUT\|RAW-ERR\|CHILD-INHERIT\|HOOKED-OUT" "$PM2_LOG"
spec "nothing from the app should leak into pm2.log"

# pm2 logs (bus) must also see the raw writes
$pm2 logs raw-stdio --lines 0 --nostream --raw > /dev/null 2>&1
timeout 3 $pm2 logs raw-stdio --lines 0 --raw > raw-stdio.bus.log 2>&1 || true
grep -q "RAW-OUT" raw-stdio.bus.log
spec "direct fd 1 write should be streamed by pm2 logs"
rm -f raw-stdio.bus.log

# reloadLogs must keep the daemon-side pipe streams alive
mv $LOGS/raw-stdio-out.log $LOGS/raw-stdio-out.rotated.log
$pm2 reloadLogs
sleep 1.5
grep -q "RAW-OUT" $LOGS/raw-stdio-out.log
spec "raw writes should land in the re-opened out log after reloadLogs"
rm -f $LOGS/raw-stdio-out.rotated.log

$pm2 delete all

# Bun has no stream._handle.setBlocking(): on Linux the worker's stdout pipe
# stays O_NONBLOCK and fs.writeSync(1) returns short past the pipe buffer
if [ "$IS_BUN" = false ]; then

echo ">>>>>>>>>>>>>>>>>>>> CLUSTER MODE: a raw fd write bigger than the pipe buffer is not truncated"

rm -f $LOGS/raw-burst-*.log

$pm2 start raw-stdio-burst.js -i 1 --name raw-burst --merge-logs

sleep 2

[ "$(grep -c '^BURST-LINE' $LOGS/raw-burst-out.log)" -eq 200 ]
spec "all 200 lines of a 400 KB fs.writeSync(1) should be in the app out log"
grep -q "BURST-LINE 200 x" $LOGS/raw-burst-out.log
spec "the last line of the burst should be in the app out log"

$pm2 delete all

fi

echo ">>>>>>>>>>>>>>>>>>>> CLUSTER MODE requested for a non Node.js script falls back to fork mode"

$pm2 start cluster-non-node.json
should 'bash script with exec_mode cluster should run in fork mode' 'fork_mode' 2
should 'bash script with exec_mode cluster should not run in cluster mode' 'cluster_mode' 0
should 'bash script with exec_mode cluster should be online' 'online' 2

$pm2 delete all

$pm2 start echo.js -i 2 --name nodeclu
should 'node script with -i should still run in cluster mode' 'cluster_mode' 2

$pm2 delete all

echo ">>>>>>>>>>>>>>>>>>>> CLUSTER MODE explicit with a Node.js interpreter of atypical basename (nodejs, node20) stays in cluster mode"

ATYPICAL_BIN="$(mktemp -d)"
ln -s "$node" "$ATYPICAL_BIN/nodejs"
ln -s "$node" "$ATYPICAL_BIN/node20"

$pm2 start esmodules/mjs/index.mjs --name mjs-nodejs -i 2 --interpreter "$ATYPICAL_BIN/nodejs"
should 'mjs with interpreter nodejs and -i should run in cluster mode' 'cluster_mode' 2
should 'mjs with interpreter nodejs and -i should be online' 'online' 2

$pm2 delete all

ATYPICAL_NODE="$ATYPICAL_BIN/node20" $pm2 start cluster-atypical-node.config.js
should 'explicit exec_mode cluster with interpreter node20 should run in cluster mode' 'cluster_mode' 1
should 'explicit exec_mode cluster with interpreter node20 should not fall back to fork mode' 'fork_mode' 0
should 'explicit exec_mode cluster with interpreter node20 should be online' 'online' 1

$pm2 delete all
rm -rf "$ATYPICAL_BIN"
