
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

set -o verbose

$pm2 kill

# Determine wget / curl
which wget > /dev/null
if [ $? -eq 0 ]
then
    http_get="wget"
else
    echo -e "\033[31mYou need wget to run this test \033[0m";
    exit 1;
fi

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
    sleep 0.5
    OUT=`$pm2 prettylist | grep -o "$2" | wc -l`
    [ $OUT -eq $3 ] || fail "$1"
    success "$1"
}
