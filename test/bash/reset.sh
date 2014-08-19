
#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

cd $file_path
$pm2 kill

echo "################## RESET ###################"

#
# BY ID
#
$pm2 start echo.js
should 'should restarted be one for all' 'restart_time: 0' 1

$pm2 restart 0
should 'should process restarted' 'restart_time: 1' 1

$pm2 reset 0
should 'should process reseted' 'restart_time: 0' 1

#
# BY NAME
#
$pm2 start echo.js -i 4 -f
should 'should restarted be one for all' 'restart_time: 0' 5

$pm2 restart echo
should 'should process restarted' 'restart_time: 1' 5

$pm2 reset echo
should 'should process reseted' 'restart_time: 0' 5


#
# ALL
#
$pm2 restart all
$pm2 restart all
$pm2 restart all
should 'should process restarted' 'restart_time: 3' 5

$pm2 reset all
should 'should process reseted' 'restart_time: 0' 5
