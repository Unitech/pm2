
#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path

# With start
$pm2 start echo.js
should 'should deep_monitoring' 'deep_monitoring' 0

$pm2 delete all

PM2_DEEP_MONITORING=true $pm2 start echo.js
should 'should deep_monitoring' 'deep_monitoring' 1

$pm2 delete all

# With restart
$pm2 start echo.js
should 'should deep_monitoring' 'deep_monitoring' 0
PM2_DEEP_MONITORING=true $pm2 restart echo
should 'should deep_monitoring' 'deep_monitoring' 1
