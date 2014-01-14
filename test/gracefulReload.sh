
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

echo "################## GRACEFUL RELOAD ###################"

###############
$pm2 kill

echo "Launching"
$pm2 start graceful-exit.js -i 4 --name="graceful" -o "grace.log" -e "grace-err.log"
should 'should start processes' 'online' 4

OUT_LOG=`$pm2 prettylist | grep -m 1 -E "pm_out_log_path:" | sed "s/.*'\([^']*\)',/\1/"`
cat /dev/null > $OUT_LOG

#### Graceful reload all

$pm2 gracefulReload all

OUT=`grep "Finished closing connections" "$OUT_LOG" | wc -l`
[ $OUT -eq 1 ] || fail "Process not restarted gracefuly"
success "Process restarted gracefuly"


cat /dev/null > $OUT_LOG

#### Graceful reload name
$pm2 gracefulReload graceful

OUT=`grep "Finished closing connections" "$OUT_LOG" | wc -l`
[ $OUT -eq 1 ] || fail "Process not restarted gracefuly"
success "Process restarted gracefuly"

$pm2 kill
