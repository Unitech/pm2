#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

cd $file_path/interpreter

########### coffee cluster test
$pm2 delete all

$pm2 start echo.coffee -i 1

sleep 1.5

should 'process should not have been restarted' 'restart_time: 0' 1
should 'process should be online' "status: 'online'" 1

########### livescript cluster test
$pm2 delete all

>livescript.log

$pm2 start echo.ls -i 1 -o livescript.log --merge-logs

sleep 1.5
grep "Hello Livescript!" livescript.log
spec "Should work on Livescript files in cluster mode"

########### livescript fork test
$pm2 delete all

>livescript.log

$pm2 start echo.ls -o livescript.log --merge-logs

sleep 1.5
grep "Hello Livescript!" livescript.log
spec "Should work on Livescript files in fork mode"

########### typescript cluster test
$pm2 delete all

>typescript.log

$pm2 start echo.ts -i 1 -o typescript.log --merge-logs

sleep 1.5
grep "Hello Typescript!" typescript.log
spec "Should work on Typescript files in cluster mode"

########### typescript fork test
$pm2 delete all

>typescript.log

$pm2 start echo.ts -o typescript.log --merge-logs

sleep 1.5

grep "Hello Typescript!" typescript.log
spec "Should work on Typescript files in fork mode"
