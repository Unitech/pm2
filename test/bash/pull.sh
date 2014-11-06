#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

echo -e "\033[1mRunning tests:\033[0m"

cd $file_path

#
# Testing pull,forward,backward methods
#
git clone https://github.com/keymetrics/app-playground.git
cd app-playground
git checkout hotfix
$pm2 start ./process.json --name app
sleep 5

OUT=`$pm2 ls | grep errored | wc -l`
[ $OUT -eq 1 ] || fail "$1"
success "$1"

OUT=`$pm2 desc 0 | grep remote | egrep -oh 'https://([^ ]+)'`
[ $OUT = "https://github.com/keymetrics/app-playground.git" ] || fail "$1"
success "$1"

OUT=`$pm2 backward app | wc -l`
[ $OUT -eq 13 ] || fail "$1"
success "$1"

OUT=`$pm2 forward app | wc -l`
[ $OUT -eq 13 ] || fail "$1"
success "$1"

OUT=`$pm2 forward app | wc -l`
[ $OUT -eq 2 ] || fail "$1"
success "$1"

OUT=`$pm2 pull app | wc -l`
[ $OUT -eq 2 ] || fail "$1"
success "$1"

OUT=`$pm2 ls | grep "16 " | wc -l`
[ $OUT -eq 1 ] || fail "$1"
success "$1"

$pm2 kill
cd ..
rm -rf ./app-playground
