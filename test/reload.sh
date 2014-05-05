#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

cd $file_path

echo "################## RELOAD ###################"

###############
$pm2 kill

echo "Reloading"
$pm2 start child.js -i 4
should 'should start processes' 'online' 4
$pm2 restart all
should 'should restarted be one for all' 'restart_time' 4
$pm2 restart child.js
should 'should restart a second time (BY SCRIPT NAME)' 'restart_time: 2' 4

$pm2 restart child
should 'should restart a third time (BY NAME)' 'restart_time: 3' 4
sleep 0.5
$pm2 reload all
sleep 0.5
should 'should RELOAD a fourth time' 'restart_time: 4' 4

############### CLUSTER STUFF
$pm2 kill

echo "Reloading"
$pm2 start child.js -i 4
should 'should start processes' 'online' 4

$pm2 start network.js -i 4
should 'should has 8 online apps' 'online' 8

should 'should has 4 api online' 'network.js' 4
should 'should has 4 child.js online' 'child.js' 4

$pm2 reload all
should 'should reload all' 'restart_time' 8

$pm2 reload child.js
should 'should reload only child.js' 'restart_time: 2' 4

$pm2 reload network.js
should 'should reload network.js' 'restart_time: 2' 8

############### BLOCKING STUFF

# this is not a networked application
$pm2 start echo.js
should 'should has 8 online apps' 'online' 9

$pm2 reload echo
should 'should not hang and fallback to restart behaviour' 'restart_time' 9



#$pm2 web
#$pm2 reload all
$pm2 kill
