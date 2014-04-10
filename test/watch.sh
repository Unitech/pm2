#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

cd $file_path

echo -e "\033[1mRunning tests:\033[0m"

#####################
# Watch for changes #
#####################
$pm2 kill

cp server-watch.bak.js server-watch.js

$pm2 --watch start server-watch.js

sleep 1

echo "setTimeout(function() { console.log('still ok') })" >> server-watch.js

for (( i = 0; i <= 30; i++ )); do
    sleep 0.2
    echo -n "."
done

$pm2 list

should 'process should have been restarted' 'restart_time: 1' 1

rm server-watch.js


###############
$pm2 kill

#
# Dont work on travis
#

# Script should fail but be started again on next change
# Sadly travis has an issue with that test, it's working and tested with node v0.11.10
# Feel free to uncomment and report to http://github.com/Unitech/pm2/issues

# cp server-watch.bak.js server-watch.js

# $pm2 start --watch server-watch.js

# echo "setTimeout(function() { process.exit(0) }, 1)" > server-watch.js

# for (( i = 0; i <= 50; i++ )); do
#     sleep 0.2
#     echo -n "."
# done

# $pm2 list
# should 'should have stopped unstable process' 'errored' 1

# cp server-watch.bak.js server-watch.js

# for (( i = 0; i <= 50; i++ )); do
#     sleep 0.2
#     echo -n "."
# done

# $pm2 list
# should 'should start the errored process again while putting file back' 'online' 1

# rm server-watch.js


# $pm2 kill

######################
# Testing watch stop #
######################

cp server-watch.bak.js server-watch.js
$pm2 start --watch server-watch.js
should 'process should be watched' 'watch: true' 1

$pm2 stop 0
sleep 1
should 'process should be watched' 'watch: true' 1

$pm2 restart 0
sleep 1
should 'process should be watched' 'watch: true' 1

$pm2 stop --watch 0
sleep 1
should 'process should not be watched' 'watch: false' 1

$pm2 restart 0

echo "setTimeout(function() { console.log('still ok') })" >> server-watch.js

for (( i = 0; i <= 30; i++ )); do
    sleep 0.2
    echo -n "."
done

$pm2 list

should 'process should not have been restarted' 'restart_time: 0' 1

$pm2 kill

rm server-watch.js

###################
# Testing restart #
###################

cp server-watch.bak.js server-watch.js
$pm2 start --watch server-watch.js
should 'process should be watched' 'watch: true' 1

$pm2 restart --watch all
should 'process should not be watched' 'watch: false' 1

$pm2 restart --watch 0
should 'process should be watched' 'watch: true' 1

$pm2 restart server-watch
should 'process should be watched' 'watch: true' 1

$pm2 kill
rm server-watch.js

################
# Testing json #
################

$pm2 start --watch all.json
sleep 1 
should 'processes should be watched' 'watch: true' 8

$pm2 stop --watch all

should 'processes should have stop being watched' 'watch: false' 8

$pm2 restart --watch all
should 'processes should be watched' 'watch: true' 8

$pm2 kill


