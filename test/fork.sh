#!/usr/bin/env bash

#
# Testing the fork mode
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
  [ $? -eq 0 ] || fail "$1"
  success "$1"
}

function ispec {
  [ $? -eq 1 ] || fail "$1"
  success "$1"
}

function should {
    OUT=`$pm2 prettylist | grep -o "$2" | wc -l`
    [ $OUT -eq $3 ] || fail "$1"
    success "$1"
}

cd $file_path

########### Fork mode
$pm2 kill

$pm2 start echo.js -x
should 'should has forked app' 'fork' 1

$pm2 restart echo.js
should 'should has forked app' 'restart_time: 1' 1

########### Fork mode
$pm2 kill

$pm2 start bashscript.sh -x --interpreter bash
should 'should has forked app' 'fork' 1

########### Auto Detective Interpreter In Fork mode

$pm2 kill

$pm2 start echo.coffee -x
should 'should has forked app' 'fork' 1

### Dump resurect should be ok
$pm2 dump

$pm2 kill

#should 'should has forked app' 'fork' 0

$pm2 resurrect
should 'should has forked app' 'fork' 1

## Delete

$pm2 delete 0
should 'should has delete process' 'fork' 0
