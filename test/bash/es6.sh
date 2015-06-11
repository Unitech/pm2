#!/usr/bin/env bash

#
# Test if iojs
#
node -e "process.exit(require('is-iojs') ? 0 : 1)"
if [ $? -eq 0 ]
then
    echo "io.js engine"
else
    echo "Node.js engine"
    exit
fi

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"
cd $file_path

echo -e "\033[1mRunning tests:\033[0m"


$pm2 start es6/main.es6
sleep 1

should 'process should have not been restarted' 'restart_time: 0' 1



$pm2 delete all

$pm2 start es6/main.js
sleep 1

shouldnot 'process should have been restarted' 'restart_time: 0' 1

$pm2 kill

$pm2 start es6/main.js --next-gen-js
sleep 1

should 'process should have not been restarted' 'restart_time: 0' 1


$pm2 delete all

$pm2 start es6/main.js --next-gen-js -i 4
sleep 1

should '(CLUSTER MODE) process should have not been restarted' 'restart_time: 0' 4


$pm2 delete all

$pm2 start es6/main.es6 -i 4
sleep 1

should '(CLUSTER MODE) process should have not been restarted' 'restart_time: 0' 4



$pm2 delete all

$pm2 start es6/main.js -i 4
sleep 1

shouldnot '(CLUSTER MODE WITHOUT ES6) process should have been restarted' 'restart_time: 0' 4
