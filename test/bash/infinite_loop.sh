#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

cd $file_path


echo "Starting infinite loop tests"

$pm2 start killtoofast.js --name unstable-process

echo -n "Waiting for process to restart too many times and pm2 to stop it"

for (( i = 0; i <= 50; i++ )); do
    sleep 0.1
    echo -n "."
done


$pm2 list
should 'should has stopped unstable process' 'errored' 1

$pm2 kill

echo "Start infinite loop tests for restart|reload"

cp killnotsofast.js killthen.js

$pm2 start killthen.js --name killthen

$pm2 list

should 'should killthen alive for a long time' 'online' 1

# Replace killthen file with the fast quit file

sleep 15
cp killtoofast.js killthen.js

echo "Restart with unstable process"

$pm2 list

$pm2 restart all  # pm2 reload should also work here

for (( i = 0; i <= 80; i++ )); do
    sleep 0.1
    echo -n "."
done

$pm2 list

should 'should has stoped unstable process' 'errored' 1

rm killthen.js

$pm2 list

$pm2 kill
