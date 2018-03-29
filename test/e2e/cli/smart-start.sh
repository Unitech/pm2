
#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path

#
# Test for SMART start
#

$pm2 start echo.js
should 'process should have been started' 'restart_time: 0' 1
should 'process should have been started' 'online' 1

$pm2 stop echo
should 'process should have been started' 'stopped' 1

$pm2 start echo
should 'process should have been started' 'online' 1

$pm2 start echo
should 'process should have been started' 'restart_time: 1' 1
should 'process should have been started' 'online' 1

$pm2 start 0
should 'process should have been started' 'restart_time: 2' 1
should 'process should have been started' 'online' 1

# $pm2 stop echo
# should 'process should have been started' 'stopped' 1

# $pm2 start all
# should 'process should have been started' 'restart_time: 2' 1
# should 'process should have been started' 'online' 1
