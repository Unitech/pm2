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
    http_get="curl"
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
  [ $? -eq 0 ] || fail "$1"
  success "$1"
}

function ispec {
  [ $? -eq 1 ] || fail "$1"
  success "$1"
}

cd $file_path

echo -e "\033[1mRunning tests:\033[0m"

$pm2 kill
spec "kill daemon"

#
# start proc with name
# stop it
# restart it by id
#
$pm2 start echo.js
$pm2 stop echo
OUT=`$pm2 prettylist | grep -o "stopped" | wc -l`
[ $OUT -eq 1 ] || fail "FAIL"
success "SUCCESS"

$pm2 restart 0
OUT=`$pm2 prettylist | grep -o "stopped" | wc -l`
[ $OUT -eq 0 ] || fail "FAIL"
success "SUCCESS"

$pm2 list




