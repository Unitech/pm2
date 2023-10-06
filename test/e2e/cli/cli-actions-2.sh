#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path

############# Start / Stop / Restart
echo "---- Start an app, stop it, if state stopped and started, restart stopped app"
$pm2 start echo.js
spec "Should start an app by script.js"
$pm2 stop echo.js
spec "Should stop an app by script.js"
$pm2 restart echo.js
spec "Should restart an app by script.js (TRANSITIONAL STATE)"

############### Start edge case

$pm2 delete all

echo "Start application with filename starting with a numeric"
$pm2 start 001-test.js
should 'should app be online' 'online' 1
$pm2 stop 001-test
should 'should app be stopped' 'stopped' 1
$pm2 restart 001-test
should 'should app be online once restart called' 'online' 1


############## PID

$pm2 delete all
$pm2 start 001-test.js --name "test"
should 'should app be online' 'online' 1
$pm2 pid > /tmp/pid-tmp
$pm2 pid test

###############

$pm2 delete all
echo "Start application with filename starting with a numeric"
$pm2 start throw-string.js -l err-string.log --merge-logs --no-automation
>err-string.log
sleep 1
grep 'throw-string.js' err-string.log
spec "Should have written raw stack when throwing a string"

####

$pm2 delete all

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
$pm2 delete all

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
$pm2 delete all
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

$pm2 kill
########### OPTIONS OUTPUT FILES
$pm2 delete all

$pm2 start echo.js -o outech.log -e errech.log --name gmail -i 2
sleep 2
cat outech-0.log > /dev/null
spec "file outech-0.log exist"
cat errech-0.log > /dev/null
spec "file errech-0.log exist"

########### Stdout / Stderr

rm stdout-stderr.log
$pm2 start stdout-stderr.js -l stdout-stderr.log --merge-logs
sleep 2
cat stdout-stderr.log | grep "outwrite"
spec "stdout written"
cat stdout-stderr.log | grep "outcb"
spec "stdout cb written"
cat stdout-stderr.log | grep "errwrite"
spec "stderr written"
cat stdout-stderr.log | grep "errcb"
spec "stderr cb written"

$pm2 delete all

# ## #2350 verify all script have been killed
# $pm2 start python-script.py
# $pm2 start echo.js
# should 'should app be online' 'online' 2

# kill `cat ~/.pm2/pm2.pid`
# spec "should have killed pm2"

# sleep 3
# pgrep "python"
# ispec "should python script be killed"
