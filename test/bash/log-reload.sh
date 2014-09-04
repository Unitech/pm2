#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

cd $file_path

echo -e "\033[1mRunning tests:\033[0m"

$pm2 kill

>out-rel.log

$pm2 start echo.js -o out-rel.log --merge-logs -i 1

$pm2 reloadLogs

sleep 1

grep "Reloading log..." out-rel.log

spec "Should have started the reloading action"

rm out-rel.log

## FORK MODE

$pm2 kill

$pm2 start echo.js -o out-rel.log -e err-rel.log -x --merge-logs

sleep 0.5

grep "ok" out-rel.log
spec "Should have written te right stuff in out log in fork mode"

grep "thisnok" err-rel.log
spec "Should have written te right stuff in err log in fork mode"

rm out-rel.log
rm err-rel.log

$pm2 reloadLogs
spec "Should have reloaded logs via CLI"

sleep 1

grep "ok" out-rel.log
spec "(RELOADED) Should have written the right stuff in out log in fork mode"

grep "thisnok" err-rel.log
spec "(RELOADED) Should have written the right stuff in err log in fork mode"

rm out-rel.log
rm err-rel.log
