#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

cd $file_path

############# TEST

echo -e "\033[1mRunning tests:\033[0m"

$pm2 kill
spec "kill daemon"

echo "---- Start an app, stop it, if state stopped and started, restart stopped app"
$pm2 start echo.js
spec "Should start an app by script.js"
$pm2 stop echo.js
spec "Should stop an app by script.js"
$pm2 restart echo.js
spec "Should restart an app by script.js (TRANSITIONAL STATE)"

###############
$pm2 kill

echo "---- BY_NAME Start an app, stop it, if state stopped and started, restart stopped app"

$pm2 start echo.js --name gege
should 'should app be online' 'online' 1
$pm2 stop gege
should 'should app be stopped' 'stopped' 1
$pm2 restart gege
should 'should app be online once restart called' 'online' 1

###############
$pm2 kill

echo "Start an app, start it one more time, if started, throw message"
$pm2 start echo.js
$pm2 start echo.js
ispec "Should not re start app"


###############
$pm2 kill

cd ../..

echo "Change path try to exec"
$pm2 start test/fixtures/echo.js
should 'should app be online' 'online' 1
$pm2 stop test/fixtures/echo.js
should 'should app be stopped' 'stopped' 1
$pm2 start test/fixtures/echo.js
should 'should app be online' 'online' 1

cd -


########### DELETED STUFF BY ID
$pm2 kill

$pm2 start echo.js
$pm2 delete 0
should 'should has been deleted process by id' "name: 'echo'" 0

########### DELETED STUFF BY NAME
$pm2 kill

$pm2 start echo.js --name test
$pm2 delete test
should 'should has been deleted process by name' "name: 'test'" 0

########### DELETED STUFF BY SCRIPT
$pm2 kill

$pm2 start echo.js
$pm2 delete echo.js
$pm2 list
should 'should has been deleted process by script' "name: 'echo'" 0


########### OPTIONS OUTPUT FILES
$pm2 kill

$pm2 start echo.js -o outech.log -e errech.log --name gmail -i 10
sleep 0.5
cat outech-0.log > /dev/null
spec "file outech.log exist"
cat errech-0.log > /dev/null
spec "file errech.log exist"
should 'should has not restarted' 'restart_time: 0' 10
