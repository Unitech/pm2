#!/usr/bin/env bash

#
# Testing the fork mode
#
# (C) 2013 Unitech.io Inc.
# MIT LICENSE
#

# Yes, we have tests in bash. How mad science is that?

# export PM2_RPC_PORT=4242
# export PM2_PUB_PORT=4243

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
sleep 1
  [ $PREV -eq 0 ] || fail "$1"
  success "$1"
}

function ispec {
PREV=$?
sleep 1
  [ $PREV -eq 1 ] || fail "$1"
  success "$1"
}


function should()
{
    OUT=`$pm2 prettylist | grep -o "$2" | wc -l`
    [ $OUT -eq $3 ] || fail "$1"
    success "$1"

}

cd $file_path
$pm2 kill

echo "################ HARMONY ES6"

$pm2 start harmony.js
sleep 2
should 'should fail when trying to launch pm2 without harmony option' 'errored' 1
$pm2 list
$pm2 kill

sleep 2

PM2_NODE_OPTIONS='--harmony' `pwd`/../../bin/pm2 start harmony.js

sleep 2
should 'should not fail when passing harmony option to V8' 'errored' 0
$pm2 list
$pm2 kill
