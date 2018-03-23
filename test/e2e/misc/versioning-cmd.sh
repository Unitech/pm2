#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path

rm -rf app-playground

git clone https://github.com/keymetrics/app-playground.git

cd app-playground

$pm2 start package.json

CUR_HASH=`$pm2 prettylist | grep "revision" | cut -d: -f2 | tr -d " ,'"`
HEAD_HASH=$CUR_HASH
echo "CURRENT GIT HASH= " $CUR_HASH
GIT_HASH=`git rev-parse HEAD`
[ $CUR_HASH == $GIT_HASH ] || fail "Wrong commit"
spec "Right commit after start"

#
# Backward
#

$pm2 backward "keymetrics tuto"

sleep 1

CUR_HASH=`$pm2 prettylist | grep "revision" | cut -d: -f2 | tr -d " ,'"`
echo "CURRENT GIT HASH= " $CUR_HASH
GIT_HASH=`git rev-parse HEAD`
[ $CUR_HASH == $GIT_HASH ] || fail "Wrong commit"
spec "Right commit after backward action"


#
# Backward
#

$pm2 backward "keymetrics tuto"

sleep 1

CUR_HASH=`$pm2 prettylist | grep "revision" | cut -d: -f2 | tr -d " ,'"`
DEEP_HASH=$CUR_HASH
echo "CURRENT GIT HASH= " $CUR_HASH
GIT_HASH=`git rev-parse HEAD`
[ $CUR_HASH == $GIT_HASH ] || fail "Wrong commit"
spec "Right commit after backward action"

#
# Forward
#
$pm2 forward "keymetrics tuto"

sleep 1

CUR_HASH=`$pm2 prettylist | grep "revision" | cut -d: -f2 | tr -d " ,'"`
echo "CURRENT GIT HASH= " $CUR_HASH
GIT_HASH=`git rev-parse HEAD`
[ $CUR_HASH == $GIT_HASH ] || fail "Wrong commit"
spec "Right commit after backward action"

#
# Pull to HEAD
#
$pm2 pull "keymetrics tuto"
sleep 1

CUR_HASH=`$pm2 prettylist | grep "revision" | cut -d: -f2 | tr -d " ,'"`
echo "CURRENT GIT HASH= " $CUR_HASH
GIT_HASH=`git rev-parse HEAD`
[ $CUR_HASH == $GIT_HASH ] || fail "Wrong commit"
spec "Right commit after pullAndReload"

[ $CUR_HASH == $HEAD_HASH ] || fail "Wrong commit"
spec "Is updated with right hash"


#
# Pull to commit id
#
$pm2 pull "keymetrics tuto" $DEEP_HASH
sleep 1

CUR_HASH=`$pm2 prettylist | grep "revision" | cut -d: -f2 | tr -d " ,'"`
echo "CURRENT GIT HASH= " $CUR_HASH
GIT_HASH=`git rev-parse HEAD`
[ $CUR_HASH == $GIT_HASH ] || fail "Wrong commit"
spec "Right commit after pullAndReload"

[ $CUR_HASH == $DEEP_HASH ] || fail "Wrong commit"
spec "Is updated with old hash"

cd ..
rm -rf app-playground
