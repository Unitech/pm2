#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

cd $file_path

echo -e "\033[1mRunning tests:\033[0m"

$pm2 kill

#
# Signal feature
#
$pm2 start signal.js -i 2
# get the log file and the id.
OUT_LOG=`$pm2 prettylist | grep -m 1 -E "pm_out_log_path:" | sed "s/.*'\([^']*\)',/\1/"`
cat /dev/null > $OUT_LOG

$pm2 sendSignal SIGUSR2 signal.js
sleep 1

OUT=`grep "SIGUSR2" "$OUT_LOG" | wc -l`
[ $OUT -eq 1 ] || fail "Signal not received by the process name"
success "Processes sucessfully receives the signal"

$pm2 stop signal.js

# Send a process by id
$pm2 start signal.js

sleep 1
# get the log file and the id.
OUT_LOG=`$pm2 prettylist | grep -m 1 -E "pm_out_log_path:" | sed "s/.*'\([^']*\)',/\1/"`
ID=`$pm2 prettylist | grep -E "pm_id:" | sed "s/.*pm_id: \([^,]*\),/\1/"`

cat /dev/null > $OUT_LOG

$pm2 sendSignal SIGUSR2 $ID

OUT=`grep "SIGUSR2" "$OUT_LOG" | wc -l`
[ $OUT -eq 1 ] || fail "Signal not received by the process name"
success "Processes sucessfully receives the signal"
