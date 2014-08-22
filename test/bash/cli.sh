#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

echo -e "\033[1mRunning tests:\033[0m"

cd $file_path

#
# Different way to stop process
#
$pm2 start echo.js
$pm2 start echo.js -f
$pm2 start echo.js -f

OUT=`$pm2 prettylist | grep -o "restart_time" | wc -l`
[ $OUT -eq 3 ] || fail "$1"
success "$1"

$pm2 stop 12412
$pm2 stop 0


OUT=`$pm2 prettylist | grep -o "stopped" | wc -l`
[ $OUT -eq 1 ] || fail "$1"
success "$1"

$pm2 stop asdsdaecho.js

$pm2 stop echo

$pm2 list
OUT=`$pm2 prettylist | grep -o "stopped" | wc -l`
[ $OUT -eq 3 ] || fail "$1"
success "$1"


#
# Describe process
#
$pm2 describe 0
spec "should describe stopped process"

$pm2 restart 1

$pm2 describe 1
spec "should describe online process"

$pm2 describe asdsa
ispec "should exit with right exit code when no process found"

#
# Update pm2
#
$pm2 updatePM2
spec "should update pm2"

#
# Main tests
#


$pm2 kill
spec "kill daemon"

$pm2 start eyayimfake
ispec "should fail if script doesnt exist"

$pm2
ispec "No argument"

$pm2 list

$pm2 start cluster-pm2.json
spec "Should start well formated json with name for file prefix"

$pm2 list
spec "Should list processes succesfully"


$pm2 start multi-echo.json
spec "Should start multiple applications"

$pm2 generate echo
spec "Should generate echo sample json"

$pm2 start echo-pm2.json -f
spec "Should start echo service"

$pm2 list


# $pm2 logs &
# spec "Should display logs"
# TMPPID=$!

# sleep 1

# kill $!
# spec "Should kill logs"

# $pm2 logs echo &
# spec "Should display logs"
# TMPPID=$!

# sleep 1

# kill $!
# spec "Should kill logs"


$pm2 web
spec "Should start web interface"

sleep 0.3

JSON_FILE='/tmp/web-json'

$http_get -q http://localhost:9615/ -O $JSON_FILE
cat $JSON_FILE | grep "HttpInterface.js" > /dev/null
spec "Should get the right JSON with HttpInterface file launched"

$pm2 flush
spec "Should clean logs"

# cat ~/.pm2/logs/echo-out.log | wc -l
# spec "File Log should be cleaned"

sleep 0.3
$http_get -q http://localhost:9615/ -O $JSON_FILE
cat $JSON_FILE | grep "restart_time\":0" > /dev/null
spec "Should get the right JSON with HttpInterface file launched"

#
# Restart only one process
#
$pm2 restart 1
should 'should has restarted process' 'restart_time: 1' 1

#
# Restart all processes
#
$pm2 restart all
spec "Should restart all processes"

sleep 0.3
$http_get -q http://localhost:9615/ -O $JSON_FILE
OUT=`cat $JSON_FILE | grep -o "restart_time\":1" | wc -l`

[ $OUT -eq 7 ] || fail "Error while wgeting data via web interface"
success "Got data from interface"


$pm2 list

$pm2 dump
spec "Should dump current processes"

$pm2 save
spec "Should save (dump alias) current processes"


ls ~/.pm2/dump.pm2
spec "Dump file should be present"

$pm2 stop all
spec "Should stop all processes"

sleep 0.5
OUT=`$pm2 prettylist | grep -o "stopped" | wc -l`
[ $OUT -eq 8 ] || fail "Process not stopped"
success "Process succesfully stopped"


$pm2 kill

#
# Issue #71
#

PROC_NAME='ECHONEST'
# Launch a script with name option
$pm2 start echo.js --name $PROC_NAME -f
OUT=`$pm2 prettylist | grep -o "ECHONEST" | wc -l`
[ $OUT -gt 0 ] || fail "Process not launched"
success "Processes sucessfully launched with a specific name"

# Restart a process by name
$pm2 restart $PROC_NAME
OUT=`$pm2 prettylist | grep -o "restart_time: 1" | wc -l`
[ $OUT -gt 0 ] || fail "Process name not restarted"
success "Processes sucessfully restarted with a specific name"





$pm2 kill

$pm2 resurrect
spec "Should resurrect all apps"

sleep 0.5
OUT=`$pm2 prettylist | grep -o "restart_time" | wc -l`
[ $OUT -eq 8 ] || fail "Not valid process number"
success "Processes valid"



$pm2 delete all
spec "Should delete all processes"

sleep 0.5
OUT=`$pm2 prettylist | grep -o "restart_time" | wc -l`
[ $OUT -eq 0 ] || fail "Process not stopped"
success "Process succesfully stopped"

#
# Cron
#
$pm2 start cron.js -c "* * * asdasd"
ispec "Cron should throw error when pattern invalid"

$pm2 start cron.js -c "* * * * * *"
spec "Should cron restart echo.js"


$pm2 kill test
ispec "Should not kill with extra args"

$pm2 kill
spec "Should kill daemon"
