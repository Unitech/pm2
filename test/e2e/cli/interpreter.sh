#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path/interpreter

rm -rf ../../../node_modules/coffee-script/
rm -rf ../../../node_modules/livescript/
rm -rf ../../../node_modules/ts-node/

########### coffee

$pm2 start echo.coffee
ispec "should not start if coffee not installed"

########### Install

$pm2 install coffee-script

########### coffee fork test
$pm2 delete all

$pm2 start echo.coffee

sleep 1.5

should 'process should not have been restarted' 'restart_time: 0' 1
should 'process should be online' "status: 'online'" 1

########### coffee cluster test
$pm2 delete all

$pm2 start echo.coffee -i 1

sleep 1.5

should 'process should not have been restarted' 'restart_time: 0' 1
should 'process should be online' "status: 'online'" 1


########## LIVESCRIPT

# $pm2 delete all
# $pm2 start echo.ls
# sleep 1
# should 'process should be errored without livescript installed' "status: 'errored'" 1

# ########### Install

# $pm2 install livescript

# ########### livescript fork test
# $pm2 delete all

# >livescript.log

# $pm2 start echo.ls -o livescript.log --merge-logs

# sleep 1.5
# grep "Hello Livescript!" livescript.log
# spec "Should work on Livescript files in fork mode"

# ########### livescript cluster test
# $pm2 delete all

# >livescript.log

# $pm2 start echo.ls -i 1 -o livescript.log --merge-logs

# sleep 1.5
# grep "Hello Livescript!" livescript.log
# spec "Should work on Livescript files in cluster mode"

########### TYPESCRIPT

########### Install


# $pm2 install typescript

# ########### typescript fork test
# $pm2 delete all

# >typescript.log

# $pm2 start echo.ts -o typescript.log --merge-logs

# sleep 1.5

# grep "Hello Typescript!" typescript.log
# spec "Should work on Typescript files in fork mode"

# ########### typescript cluster test
# $pm2 delete all

# >typescript.log

# $pm2 start echo.ts -i 1 -o typescript.log --merge-logs

# sleep 1.5
# grep "Hello Typescript!" typescript.log
# spec "Should work on Typescript files in cluster mode"
