#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"
cd $file_path

echo -e "\033[1mRunning tests for json files :\033[0m"

PM2_WORKER_INTERVAL=90000 $pm2 start all.json
should 'should start processes' 'online' 6

$pm2 stop all.json
should 'should stop processes' 'stopped' 6

$pm2 delete all.json
should 'should start processes' 'online' 0

$pm2 start all.json
should 'should start processes' 'online' 6

$pm2 restart all.json
should 'should stop processes' 'online' 6
should 'should all script been restarted one time' 'restart_time: 1' 6

$pm2 reload all.json
sleep 1
should 'should reload processes' 'online' 6
should 'should all script been restarted one time' 'restart_time: 2' 6

$pm2 gracefulReload all.json
sleep 1
should 'should graceful reload processes' 'online' 6
should 'should all script been restarted one time' 'restart_time: 3' 6

##
## Smart restart
##
$pm2 start all.json
sleep 1
should 'should smart restart processes' 'online' 6
should 'should all script been restarted one time' 'restart_time: 4' 6

$pm2 stop all.json
sleep 1
should 'should stop processes' 'stopped' 6

$pm2 start all.json
should 'should smart restart processes' 'online' 6

# $pm2 stop all.json
# sleep 1
# should 'should stop processes' 'stopped' 6

# $pm2 start all
# should 'should smart restart processes' 'online' 6

$pm2 kill

########## JS style

PM2_WORKER_INTERVAL=90000 $pm2 start configuration.json
should 'should start processes' 'online' 6

$pm2 stop configuration.json
should 'should stop processes' 'stopped' 6

$pm2 delete configuration.json
should 'should start processes' 'online' 0

$pm2 start configuration.json
should 'should start processes' 'online' 6

$pm2 restart configuration.json
should 'should stop processes' 'online' 6
should 'should all script been restarted one time' 'restart_time: 1' 6

$pm2 delete configuration.json
should 'should delete processes' 'online' 0

########## PIPE command

$pm2 kill

cat all.json | $pm2 start -
should 'should start processes' 'online' 6

$pm2 kill

#
# CWD OPTION
#

#$pm2 kill

#$pm2 start change_cwd.json
#sleep 1
#should 'should start 2 processes' 'online' 2

#$pm2 delete all

#$pm2 start no_cwd_change.json
#sleep 1
#should 'should not start 2 processes because of paths' 'online' 0
