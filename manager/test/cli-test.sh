#!/usr/bin/env bash

#
# cli-test: Tests for blackbird CLI
#
# (C) 2012 Wiredcraft Inc.
# MIT LICENSE
#

# Yes, we have tests in bash. How mad science is that?

node="`type -P node`"
pm2="`type -P node` `pwd`/bin/cli"

script="echo"

file_path="test/fixtures"
file_script="toto.json"

function fail {
  echo -e "\033[31m  ✘ $1\033[0m"
  exit 1
}

function success {
  echo -e "\033[32m  ✔ $1\033[0m"
}

function spec {
  [ $? -eq 0 ] || fail "$1"
  success "$1"
}



echo -e "\033[1mRunning tests:\033[0m"

# First kill all processes and remove pm2 directory to ensure clean 
# environment
$pm2 stop

#rm -rf ~/.pm2

# Spawn some process
$pm2 start "$script"


# Assert that pm2 actually spawned a process and that it's in `pm2 list`
sleep 1 # it takes some time until process appears in `pm2 list`
$pm2 list | grep "$script"
spec "\`pm2 list\` should contain spawned process"

# List processes in json
$pm2 jlist
spec "\`pm2 list\` should list processes in JSON"

# `pm2 stop` should output process it stopped...
$pm2 stop
sleep 1
spec "\`pm2 stop \` should kill all processes"

# ... and actually stop it
$pm2 list | grep -v "$script"
spec "\`pm2 stop 0\` should actually stop the process"


#
# Duplicate script launch
#
cd $file_path

$pm2 s "$file_script"
$pm2 s "$file_script"
[ $? -eq 0 ] || success 'pm2 s <script> 2 times should throw error message'

#
# Show logs
#
sleep 1
$pm2 logs &
spec "\`pm2 logs\` should show the logs"

sleep 3
kill $!
spec "\`pm2 logs\` kill logs"

#
# Generate a sample
#
$pm2 generate test

FILE='test-pm2.json'
FILE_BIN='test.js'

stat $FILE
spec "\`pm2 generate sample_file\` generate successfuly sample single app"

echo "setInterval(function() { console.log(process.env.PM_APP_TITLE); }, 130);" > $FILE_BIN
$pm2 start $FILE

spec "\`pm2 stat $FILE_BIN\` should launch a second process"



#
# Multiple exec
#

FILE_BIN_1='echo1.js'
FILE_BIN_2='echo2.js'
CONFIG_MULTIPLE='multiple.json'

echo "setInterval(function() { console.log(process.env.PM_APP_TITLE); }, 130);" > $FILE_BIN_1
echo "setInterval(function() { console.log(process.env.PM_APP_TITLE); }, 130);" > $FILE_BIN_2

echo '[{
    "path" : "echo1.js",
    "outFile" : "out-echo1.log",
    "errFile" : "err-echo1.log",
    "pidFile" : "exec-echo1.pid",
    "options": ["foo"],
    "env": {
	"DEBUG": "*",
	"PM_APP_TITLE" : "echo1"
    }
},{
    "path" : "echo2.js",
    "outFile" : "out-echo2.log",
    "errFile" : "err-echo2.log",
    "pidFile" : "exec-echo2.pid",
    "options": ["foo"],
    "env": {
	"DEBUG": "*",
	"PM_APP_TITLE" : "echo2"
    }
}]' > $CONFIG_MULTIPLE


$pm2 start $CONFIG_MULTIPLE
spec "\`pm2 l\` should start multi process (2 processes)"

sleep 2

$pm2 l
spec "\`pm2 l\` list processes (4 processes)"

$pm2 logs &
sleep 2
kill $!
spec "\`pm2 logs\` show multiple logger"


#
# Monit process
#

which xterm

if [ $? -eq 0 ]; then
    xterm -e "$pm2 monit" &
    spec "\`pm2 monit\` should show monit stuff"
    
    sleep 5
    kill $!
    spec "\`pm2 logs\` kill monit"

    FILE_APPENDED=testo2.js
    echo "Watching current folder"
    xterm -e "$pm2 watch" &
    PID_K=$!
    sleep 2
    touch $FILE_APPENDED
    sleep 5
    kill $PID_K
fi


echo "Removing sample files"
rm -v $FILE
rm -v $FILE_BIN
rm -v $FILE_BIN_1
rm -v $FILE_BIN_2
rm -v $FILE_APPENDED
rm -v ../../*.log

$pm2 stop
