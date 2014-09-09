#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

cd $file_path

function waituntil {
  for (( i = 0; i <= $1; i++ )); do
      sleep 0.2
      echo -n "."
  done
  echo ""
}

echo -e "\033[1mRunning tests:\033[0m"

#####################
# Watch for changes #
#####################

>server-watch.js

$pm2 kill

cp server-watch.bak.js server-watch.js

$pm2 start server-watch.js --watch

should 'process should be watched' 'watch: true' 1

echo "console.log('test');" >> server-watch.js

sleep 1

cat server-watch.js
$pm2 list

should 'process should have been restarted' 'restart_time: 1' 1
should 'process should be online' "status: 'online'" 1

$pm2 kill

sleep 1

rm server-watch.js

###############

# Script should fail but be started again on next change
# Sadly travis has an issue with that test, it's working and tested with node v0.11.10
# Feel free to uncomment and report to http://github.com/Unitech/pm2/issues

# cp server-watch.bak.js server-watch.js

# $pm2 start --watch server-watch.js

# echo "setTimeout(function() { process.exit(0) }, 1)" > server-watch.js

# for (( i = 0; i <= 30; i++ )); do
#     sleep 0.2
#     echo -n "."
# done

# $pm2 list
# should 'should have stopped unstable process' 'errored' 1

# cp server-watch.bak.js server-watch.js

# for (( i = 0; i <= 10; i++ )); do
#     sleep 0.2
#     echo -n "."
# done

# $pm2 list
# should 'should start the errored process again while putting file back' 'online' 1

# $pm2 kill
# rm server-watch.js

###############

cp server-watch.bak.js server-watch.js

$pm2 start --watch server-watch.js

$pm2 restart 0

should 'process should be watched' 'watch: true' 1

$pm2 stop --watch 0

should 'process should have stopped beeing watched' 'watch: false' 1

echo "setInterval(function() { console.log('still ok'); }, 100);" > server-watch.js

should 'process should not have been restarted on file change' 'restart_time: 1' 1

cp server-watch.bak.js server-watch.js

$pm2 restart 0

should 'process should restart and not be watched' 'watch: false' 1

#$pm2 restart --watch 0
#should 'process should be watched' 'watch: true' 1

$pm2 kill

rm server-watch.js
#############
# JSON test #
#############
# we've already seen before that "watch: true" is really watching when changing a file

# $pm2 start --watch all.json

# should 'processes should be watched' 'watch: true' 8

# $pm2 stop --watch all

# should 'processes should have stop being watched' 'watch: false' 8

# $pm2 restart --watch all
# should 'processes should be watched' 'watch: true' 8

# $pm2 kill

##########
# delete #
##########

cp server-watch.bak.js server-watch.js

$pm2 start server-watch.js --watch
$pm2 stop 0
$pm2 delete 0

echo "setTimeout(function() { console.log('watch me!') })" >> server-watch.js

waituntil 10

should 'process should not have been restarted' 'watch: true' 0

$pm2 delete all
rm server-watch.js

###########
# cluster #
###########

cp server-watch.bak.js server-watch.js

$pm2 start server-watch.js --watch -i 4

should 'processes should be watched' 'watch: true' 4

##############
# connection #
##############

wget -qO- http://localhost:8000 > /dev/null

spec "Got connection"

echo "console.log('test');" >> server-watch.js

sleep 2

should 'process should have been restarted' 'restart_time: 1' 4

$pm2 list

wget -qO- http://localhost:8000 > /dev/null
spec "Got connection"

#######################
# make sure isolation #
#######################

$pm2 start server-watch.js -i 4 --name "server-2" -f

$pm2 list

echo "console.log('test');" >> server-watch.js

sleep 2
should 'right processes should have been restarted' 'restart_time: 2' 4

$pm2 restart "server-2"

should 'right processes should have been restarted' 'restart_time: 1' 4
rm server-watch.js
