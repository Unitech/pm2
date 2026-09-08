#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path

LOG_PATH_PREFIX="${SRC}/__log-regex__"
rm -rf "${LOG_PATH_PREFIX}"
mkdir "${LOG_PATH_PREFIX}"

$pm2 start echo.js --name re-app-one
$pm2 start echo.js --name re-app-two
$pm2 start echo.js --name other-app

# regex + --lines 0 (streaming only) #5196
OUT="${LOG_PATH_PREFIX}/lines-zero.log"
$pm2 logs "/re-app-(one|two)/" --lines 0 > $OUT &
sleep 2
grep -q "re-app-one" $OUT
spec "regex --lines 0: should stream re-app-one"
grep -q "re-app-two" $OUT
spec "regex --lines 0: should stream re-app-two"
grep -q "other-app" $OUT
ispec "regex --lines 0: should not stream other-app"

# regex + --lines 3 (tail + stream)
OUT="${LOG_PATH_PREFIX}/lines-three.log"
$pm2 logs "/re-app-(one|two)/" --lines 3 > $OUT &
sleep 2
grep -q "re-app-one" $OUT
spec "regex --lines 3: should stream re-app-one"
grep -q "other-app" $OUT
ispec "regex --lines 3: should not stream other-app"

# regex containing an inner slash must not be mangled
$pm2 start echo.js --name "re/slash"
OUT="${LOG_PATH_PREFIX}/slash.log"
$pm2 logs "/^re\/slash$/" --lines 0 > $OUT &
sleep 2
grep -q "re/slash" $OUT
spec "regex with inner slash: should stream re/slash"
grep -q "re-app-one" $OUT
ispec "regex with inner slash: should not stream re-app-one"

# app started after `pm2 logs` is picked up by the regex
OUT="${LOG_PATH_PREFIX}/late.log"
$pm2 logs "/re-app-/" --lines 0 > $OUT &
sleep 1
$pm2 start echo.js --name re-app-late
sleep 2
grep -q "re-app-late" $OUT
spec "regex: app started after pm2 logs should be streamed"

kill $(jobs -p) 2>/dev/null
cd ${SRC}
rm -rf "${LOG_PATH_PREFIX}"
$pm2 delete all
