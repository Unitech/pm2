#!/usr/bin/env bash
SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path

## FORK MODE

$pm2 kill

$pm2 start echo.js -o out-rel.log -e err-rel.log -x --merge-logs

sleep 2

grep "echo.js" out-rel.log
spec "Should have written te right stuff in out log in fork mode"

grep "echo.js-error" err-rel.log
spec "Should have written te right stuff in err log in fork mode"

rm out-rel.log
rm err-rel.log

$pm2 reloadLogs
spec "Should have reloaded logs via CLI"

sleep 2

grep "echo.js" out-rel.log
spec "(RELOADED) Should have written the right stuff in out log in fork mode"

grep "echo.js-error" err-rel.log
spec "(RELOADED) Should have written the right stuff in err log in fork mode"

rm out-rel.log
rm err-rel.log

## FORK MODE, OUT LOG SET TO /dev/null, RELOAD TWICE (issue #5509)

$pm2 kill

$pm2 start echo.js -o /dev/null -e err-rel.log -x --merge-logs

sleep 2

rm err-rel.log
$pm2 reloadLogs
spec "Should have reloaded logs a first time with /dev/null out log"

sleep 2

grep "echo.js-error" err-rel.log
spec "(RELOADED ONCE) Should have written err log with /dev/null out log in fork mode"

rm err-rel.log
$pm2 reloadLogs
spec "Should have reloaded logs a second time with /dev/null out log"

sleep 2

grep "echo.js-error" err-rel.log
spec "(RELOADED TWICE) Should have written err log with /dev/null out log in fork mode"

rm err-rel.log