
#!/usr/bin/env bash

#
# Testing the fork mode
#
# (C) 2013 Unitech.io Inc.
# MIT LICENSE
#

# Yes, we have tests in bash. How mad science is that?


export PM2_RPC_PORT=4242
export PM2_PUB_PORT=4243

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

echo "Starting infinite loop tests"

$pm2 kill

$pm2 start killtoofast.js --name unstable-process

echo -n "Waiting for process to restart too many times and pm2 to stop it"

for (( i = 0; i <= 50; i++ )); do
    sleep 0.1
    echo -n "."
done


$pm2 list
should 'should has stopped unstable process' 'errored' 1

$pm2 kill

echo "Start infinite loop tests for restart|reload"

$pm2 kill

cp killnotsofast.js killthen.js

$pm2 start killthen.js --name killthen

$pme list

should 'should killthen alive for a long time' 'online' 1

# Replace killthen file with the fast quit file
cp killtoofast.js killthen.js

$pm2 restart killthen  # pm2 reload should also work here

$pm2 list

for (( i = 0; i <= 50; i++ )); do
    sleep 0.1
    echo -n "."
done

should 'should has stoped unstable process' 'errored' 1

rm killthen.js

$pm2 kill
