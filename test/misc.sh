
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

function should {
    OUT=`$pm2 prettylist | grep -o "$2" | wc -l`
    [ $OUT -eq $3 ] || fail "$1"
    success "$1"
}

cd $file_path

echo -e "\033[1mRunning tests:\033[0m"


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

$pm2 reload unknownname
ispec "Should throw an error as unknow name"


$pm2 kill

$pm2 start env.js

OUT_LOG=`$pm2 prettylist | grep -m 1 -E "pm_out_log_path:" | sed "s/.*'\([^']*\)',/\1/"`

cat /dev/null > $OUT_LOG

sleep 1

OUT=`cat $OUT_LOG | head -n 1`

if [ $OUT = "undefined" ]
then
    success "environment variable not defined"
else
    fail "environment defined ? wtf ?"
fi

$pm2 kill

$pm2 start env.json

cat /dev/null > $OUT_LOG

sleep 1

OUT=`cat $OUT_LOG | head -n 1`

if [ $OUT = "undefined" ]
then
    fail "environment variable hasnt been defined"
else
    success "environment variable successfully defined"
fi
