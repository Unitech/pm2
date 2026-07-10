#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path/log-namespace/

LOG_PATH_PREFIX="${SRC}/__log-namespace__"

rm -rf "${LOG_PATH_PREFIX}"
mkdir "${LOG_PATH_PREFIX}"

# The first operation that starts the daemon needs to be in the foreground, otherwise we risk starting multiple
$pm2 ping

LOG_FILE_PREMATURE="${LOG_PATH_PREFIX}/premature-log-out.log"
$pm2 logs e2e-test-log-namespace > $LOG_FILE_PREMATURE & # backgrounded - will be stopped by `$pm2 delete all`

$pm2 start echo.js --namespace e2e-test-log-namespace

LOG_FILE_BASELINE="${LOG_PATH_PREFIX}/baseline-out.log"
$pm2 logs e2e-test-log-namespace > $LOG_FILE_BASELINE & # backgrounded - will be stopped by `$pm2 delete all`

sleep 2 # should leave time for ~40 "tick" lines

# Using -q to avoid spamming, since there will be a fair few "tick" matches
grep -q "tick" ${LOG_FILE_BASELINE}
spec "Should have 'tick' in the log file"
grep -q "tick" ${LOG_FILE_PREMATURE}
spec "Should have 'tick' in the log file even if 'log' called before 'start'"

LOG_FILE_LINES_ZERO="${LOG_PATH_PREFIX}/lines-zero-out.log"
$pm2 logs e2e-test-log-namespace --lines 0 > $LOG_FILE_LINES_ZERO &

sleep 2 # should leave time for ~40 "tick" lines

# Using -q to avoid spamming, since there will be a fair few "tick" matches
grep -q "tick" ${LOG_FILE_LINES_ZERO}
spec "Should have 'tick' in the log file even if using --lines 0"

cd ${SRC}
rm -rf "${LOG_PATH_PREFIX}"
$pm2 delete all
