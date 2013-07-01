#!/usr/bin/env bash

#
# cli-test: Tests for god
#
# (C) 2013 Unitech.io Inc.
# MIT LICENSE
#

# Yes, we have tests in bash. How mad science is that?


node="`type -P node`"
nodeVersion="`$node -v`"
pm2="`type -P node` `pwd`/bin/pm2"

script="echo"

file_path="test/fixtures"

function fail {
  echo -e "######## \033[31m  ✘ $1\033[0m"
  exit 1
}

function success {
  echo -e "\033[32m------------> ✔ $1\033[0m"
}

function spec {
  [ $? -eq 0 ] || fail "$1"
  success "$1"
}

function ispec {
  [ $? -eq 1 ] || fail "$1"
  success "$1"
}

echo -e "\033[1mRunning tests:\033[0m"



echo "####################### DEBUG ############################"
echo "PM2 Command = " $pm2
echo "PM2 version = " $pm2 -V
echo "Node version = " $nodeVersion

$node -e "var os = require('os'); console.log('arch : %s\nplatform : %s\nrelease : %s\ntype : %s\nmem : %d', os.arch(), os.platform(), os.release(), os.type(), os.totalmem())"
echo "###################### !DEBUG! ###########################"

cd $file_path

$pm2 kill
spec "kill daemon"

$pm2 start eyayimfake
ispec "should fail if script doesnt exist"

$pm2
ispec "No argument"

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

$pm2 logs &
spec "Should display logs"
TMPPID=$!

sleep 1

kill $!
spec "Should kill logs"

$pm2 web
spec "Should start web interface"

sleep 0.3

JSON_FILE='/tmp/web-json'

wget -q http://localhost:9615/ -O $JSON_FILE
cat $JSON_FILE | grep "HttpInterface.js" > /dev/null
spec "Should get the right JSON with HttpInterface file launched"

$pm2 flush
spec "Should clean logs"

cat ~/.pm2/logs/echo-out.log | wc -l
spec "File Log should be cleaned"

sleep 0.3
wget -q http://localhost:9615/ -O $JSON_FILE
cat $JSON_FILE | grep "restart_time\":0" > /dev/null
spec "Should get the right JSON with HttpInterface file launched"

#
# Restart only one process
#
$pm2 restart 1
sleep 0.3
wget -q http://localhost:9615/ -O $JSON_FILE
OUT=`cat $JSON_FILE | grep -o "restart_time\":1" | wc -l`
[ $OUT -eq 1 ] || fail "$1"
success "$1"

#
# Restart all processes
#
$pm2 restartAll
spec "Should restart all processes"

sleep 0.3
wget -q http://localhost:9615/ -O $JSON_FILE
OUT=`cat $JSON_FILE | grep -o "restart_time\":1" | wc -l`

[ $OUT -eq 7 ] || fail "$1"
success "$1"

#
# Cron
#
$pm2 start cron.js -c "* * * asdasd"
ispec "Cron should throw error when pattern invalid"

$pm2 start cron.js -c "* * * * * *"
spec "Should cron restart echo.js"

$pm2 list

$pm2 dump
spec "Should dump current processes"

ls ~/.pm2/dump.pm2
spec "Dump file should be present"

$pm2 stopAll
spec "Should stop all processes"

sleep 0.5
OUT=`$pm2 jlist | grep -o "restart_time" | wc -l`
[ $OUT -eq 0 ] || fail "Process not stopped"
success "Process succesfully stopped"


$pm2 kill

$pm2 resurrect
spec "Should resurect all apps"

sleep 0.5
OUT=`$pm2 jlist | grep -o "restart_time" | wc -l`
[ $OUT -eq 9 ] || fail "Not valid process number"
success "Processes valid"

$pm2 stopAll
spec "Should stop all processes"

sleep 0.5
OUT=`$pm2 jlist | grep -o "restart_time" | wc -l`
[ $OUT -eq 0 ] || fail "Process not stopped"
success "Process succesfully stopped"

$pm2 kill
spec "Should kill daemon"
