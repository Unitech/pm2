#!/usr/bin/env bash

SRC=$(
  cd $(dirname "$0")
  pwd
)
source "${SRC}/../include.sh"

cd $file_path/log-create-not-exist-dir/

LOG_PATH_PREFIX="${SRC}/__log-create-not-exist-dir__"

# a long path directory, to make sure that creating the directory is using synchronous mode
# if using asynchronous mode, creating the long path directory would fail.
LOG_FILE="${LOG_PATH_PREFIX}/a-deep/path/which/should/cost/lots/of/time/to/create/the/directory/out-rel.log"
rm -rf "${LOG_PATH_PREFIX}"
$pm2 start echo.js -o ${LOG_FILE}

spec "Should have the exit code 0";

sleep 2

grep "start" ${LOG_FILE}

spec "Should have 'start' in the log file"

cd ${SRC}
rm -rf "${LOG_PATH_PREFIX}"
$pm2 delete all
