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

# Determine wget / curl
which wget
if [ $? -eq 1 ]
then
    http_get="wget"
else
    http_get="wget"
fi


echo $http_get

function fail {
  echo -e "######## \033[31m  ✘ $1\033[0m"
  exit 1
}

function success {
  echo -e "\033[32m------------> ✔ $1\033[0m"
}

function spec {
PREV=$?
sleep 0.2
  [ $PREV -eq 0 ] || fail "$1"
  success "$1"
}

function ispec {
PREV=$?
sleep 0.2
  [ $PREV -eq 1 ] || fail "$1"
  success "$1"
}

cd $file_path

echo -e "\033[1mRunning tests:\033[0m"

$pm2 kill

#
# Signal feature
#
$pm2 start signal.js -i 2
# get the log file and the id.
OUT_LOG=`$pm2 prettylist | grep -m 1 -E "pm_out_log_path:" | sed "s/.*'\([^']*\)',/\1/"`
cat /dev/null > $OUT_LOG

$pm2 sendSignal SIGUSR2 signal.js

sleep 1
OUT=`grep "SIGUSR2" "$OUT_LOG" | wc -l`
[ $OUT -eq 2 ] || fail "Signal not received by the process name"
success "Processes sucessfully receives the signal"

$pm2 stop signal.js

# Send a process by id
$pm2 start signal.js

sleep 1
# get the log file and the id.
OUT_LOG=`$pm2 prettylist | grep -m 1 -E "pm_out_log_path:" | sed "s/.*'\([^']*\)',/\1/"`
ID=`$pm2 prettylist | grep -E "pm_id:" | sed "s/.*pm_id: \([^,]*\),/\1/"`

cat /dev/null > $OUT_LOG

$pm2 sendSignal SIGUSR2 $ID

OUT=`grep "SIGUSR2" "$OUT_LOG" | wc -l`
[ $OUT -eq 1 ] || fail "Signal not received by the process name"
success "Processes sucessfully receives the signal"
