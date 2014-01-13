#!/usr/bin/env bash

#
# cli-test: Tests for god
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

echo "################## RELOAD ###################"

###############
$pm2 kill

echo "Reloading"
$pm2 start child.js -i 4
should 'should start processes' 'online' 4
$pm2 restart all
should 'should restarted be one for all' 'restart_time' 4
$pm2 restart child.js
should 'should restart a second time (BY SCRIPT NAME)' 'restart_time: 2' 4
$pm2 restart child
should 'should restart a third time (BY NAME)' 'restart_time: 3' 4
$pm2 reload all
should 'should RELOAD a fourth time' 'restart_time: 4' 4

############### CLUSTER STUFF
$pm2 kill

echo "Reloading"
$pm2 start child.js -i 4
should 'should start processes' 'online' 4

$pm2 start network.js -i 4
should 'should has 8 online apps' 'online' 8

should 'should has 4 api online' 'network.js' 4
should 'should has 4 child.js online' 'child.js' 4

$pm2 reload all
should 'should reload all' 'restart_time' 8

$pm2 reload child.js
should 'should reload only child.js' 'restart_time: 2' 4

$pm2 reload network.js
should 'should reload network.js' 'restart_time: 2' 8

############### BLOCKING STUFF

# this is not a networked application
$pm2 start echo.js
should 'should has 8 online apps' 'online' 9

$pm2 reload echo
should 'should not hang and fallback to restart behaviour' 'restart_time' 9



#$pm2 web
#$pm2 reload all
$pm2 kill
