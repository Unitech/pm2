#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path/interpreter

########### typescript fork test
$pm2 delete all

>typescript.log

$pm2 start echo.ts -o typescript.log --merge-logs

sleep 1.5

grep "Hello Typescript!" typescript.log
spec "Should work on Typescript files in fork mode"

# ########### typescript cluster test
$pm2 delete all

>typescript.log

$pm2 start echo.tsx -o typescript.log --merge-logs

sleep 1.5

grep "Hello Typescript!" typescript.log
spec "Should work on Typescript files in fork mode"

########### cluster mode with --log-date-format keeps one entry per line
$pm2 delete all

>date-out.log
>date-err.log

$pm2 start echo-lines.ts -i 1 --log-date-format "YYYY" -o date-out.log -e date-err.log --merge-logs

sleep 1.5

[ "$(grep -c '^[0-9]\{4\}: line \(one\|two\)$' date-out.log)" -eq 2 ]
spec "Should end each out log entry with a newline in cluster mode with --log-date-format"

[ "$(grep -c '^[0-9]\{4\}: error \(one\|two\)$' date-err.log)" -eq 2 ]
spec "Should end each error log entry with a newline in cluster mode with --log-date-format"

rm -f date-out.log date-err.log

$pm2 delete all
