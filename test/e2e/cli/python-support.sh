#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path/extra-lang

which python
spec "should have python installed"

#
# Config file
#

$pm2 start app-python.config.js --only 'echo-python-1'
should 'should mode be fork' 'fork_mode' 1
should 'should have started 1 apps' 'online' 1

$pm2 delete all

# Check with multi instances
$pm2 start app-python.config.js --only 'echo-python-max'
should 'should mode be fork' 'fork_mode' 4
should 'should have started 4 apps' 'online' 4

# Should keep same params on restart
$pm2 restart all
should 'should have restarted processes' 'restart_time: 1' 4
should 'should mode be fork' 'fork_mode' 4

$pm2 delete all

#
# CLI
#

$pm2 start echo.py
should 'should mode be fork' 'fork_mode' 1
should 'should have started 1 apps' 'online' 1

$pm2 delete all

$pm2 start echo.py -i 4
should 'should mode be fork' 'fork_mode' 4
should 'should have started 4 apps' 'online' 4

$pm2 restart all
should 'should have restarted processes' 'restart_time: 1' 4
should 'should mode be fork' 'fork_mode' 4
