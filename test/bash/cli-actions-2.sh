#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

cd $file_path

############# TEST

echo -e "\033[1mRunning tests:\033[0m"

echo "---- Start an app, stop it, if state stopped and started, restart stopped app"
$pm2 start echo.js
spec "Should start an app by script.js"
$pm2 stop echo.js
spec "Should stop an app by script.js"
$pm2 restart echo.js
spec "Should restart an app by script.js (TRANSITIONAL STATE)"

###############
$pm2 delete all

echo "Start application with filename starting with a numeric"
$pm2 start 001-test.js
should 'should app be online' 'online' 1
$pm2 stop 001-test
should 'should app be stopped' 'stopped' 1
$pm2 restart 001-test
should 'should app be online once restart called' 'online' 1

$pm2 delete all

###############

echo "Start application with filename starting with a numeric"
$pm2 start throw-string.js -l err-string.log --merge-logs --no-automation
>err-string.log
sleep 2
grep 'throw-string.js' err-string.log
spec "Should have written raw stack when throwing a string"

$pm2 delete all

####

$pm2 start echo.js --name gege
should 'should app be online' 'online' 1
$pm2 stop gege
should 'should app be stopped' 'stopped' 1
$pm2 restart gege
should 'should app be online once restart called' 'online' 1

###############
$pm2 delete all

echo "---- BY_NAME Start an app, stop it, if state stopped and started, restart stopped app"

$pm2 start echo.js --name gege
should 'should app be online' 'online' 1
$pm2 stop gege
should 'should app be stopped' 'stopped' 1
$pm2 restart gege
should 'should app be online once restart called' 'online' 1

###############
$pm2 delete all

echo "Start an app, start it one more time, if started, throw message"
$pm2 start echo.js
$pm2 start echo.js
ispec "Should not re start app"

########### DELETED STUFF BY ID
$pm2 kill

$pm2 start echo.js
$pm2 delete 0
should 'should has been deleted process by id' "name: 'echo'" 0

########### DELETED STUFF BY NAME
$pm2 delete all

$pm2 start echo.js --name test
$pm2 delete test
should 'should has been deleted process by name' "name: 'test'" 0

########### DELETED STUFF BY SCRIPT
$pm2 delete all

$pm2 start echo.js
$pm2 delete echo.js
$pm2 list
should 'should has been deleted process by script' "name: 'echo'" 0

######## Actions on app name as number (#1937)
$pm2 kill
$pm2 start echo.js --name "455"
should 'should restart processes' 'restart_time: 0' 1
$pm2 restart 455
should 'should restart processes' 'restart_time: 1' 1
$pm2 restart 0
should 'should restart processes' 'restart_time: 2' 1
$pm2 stop 455
should 'should app be stopped' 'stopped' 1
$pm2 delete 455
should 'should has been deleted process by id' "name: '455'" 0

########### OPTIONS OUTPUT FILES
$pm2 kill

$pm2 start echo.js -o outech.log -e errech.log --name gmail -i 10
sleep 1
cat outech-0.log > /dev/null
spec "file outech-0.log exist"
cat errech-0.log > /dev/null
spec "file errech-0.log exist"

########### Stdout / Stderr

rm stdout-stderr.log
$pm2 start stdout-stderr.js -l stdout-stderr.log --merge-logs
sleep 0.5
cat stdout-stderr.log | grep "outwrite"
spec "stdout written"
cat stdout-stderr.log | grep "outcb"
spec "stdout cb written"
cat stdout-stderr.log | grep "errwrite"
spec "stderr written"
cat stdout-stderr.log | grep "errcb"
spec "stderr cb written"
