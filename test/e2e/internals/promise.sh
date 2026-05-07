#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path/promise/

echo "###### Cluster mode"
> rejection.log
$pm2 start rejection.js -i 1 -l rejection.log --merge-logs
sleep 2
should 'should has not restarted process' 'restart_time: 0' 1
cat rejection.log | grep "Errorla"
spec "should have logged promise error"

$pm2 delete all

> empty-rejection.log
$pm2 start empty-rejection.js -i 1 -l empty-rejection.log --merge-logs
sleep 2
should 'should has not restarted process' 'restart_time: 0' 1

cat empty-rejection.log | grep "You have triggered an unhandledRejection, you may have forgotten to catch a Promise rejection"
spec "should have logged promise error"

$pm2 delete all

echo "###### Fork mode"

> rejection.log
$pm2 start rejection.js -l rejection.log --merge-logs
sleep 2
should 'should has not restarted process' 'restart_time: 0' 1

cat rejection.log | grep "You have triggered an unhandledRejection, you may have forgotten to catch a Promise rejection"
spec "should have logged promise error"

$pm2 delete all

> empty-rejection.log
$pm2 start empty-rejection.js -l empty-rejection.log --merge-logs
sleep 2
should 'should has not restarted process' 'restart_time: 0' 1

cat empty-rejection.log | grep "You have triggered an unhandledRejection, you may have forgotten to catch a Promise rejection"
spec "should have logged promise error"
