#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path

$pm2 interact kill

#
# Testing pull,forward,backward methods
#

if [ $TRAVIS ]
then
    git config --global user.email "jshkurti@student.42.fr"
    git config --global user.name "jshkurti"
fi

rm -rf ./app-playground

git clone https://github.com/keymetrics/app-playground.git

cd app-playground

git checkout hotfix

# set max_memory_restart to 160M by default. MAC does not support `sed -i`
echo `sed -e 's/"160"/"160M"/' process.json` >| process.json

$pm2 start ./process.json --name app
sleep 5


OUT=`$pm2 ls | grep errored | wc -l`
[ $OUT -eq 1 ] || fail "Process should be errored because node_modules are missing"
success "Process should be errored because node_modules are missing"

OUT=`$pm2 info 0 | grep remote | egrep -oh 'https://([^ ]+)'`
[ $OUT = "https://github.com/keymetrics/app-playground.git" ] || fail "Remote URL should be right"
success "Remote URL should be right"

OUT=`$pm2 backward app | wc -l`
[ $OUT -eq 13 ] || fail "Backward method should work properly and print adequate output"
success "Backward method should work properly and print adequate output"

OUT=`$pm2 forward app | wc -l`
[ $OUT -eq 13 ] || fail "Forward method should work properly and print adequate output"
success "Forward method should work properly and print adequate output"

OUT=`$pm2 forward app | wc -l`
[ $OUT -eq 2 ] || fail "Forward method should fail and thus print 2-lined output"
success "Forward method should fail and thus print 2-lined output"

OUT=`$pm2 pull app | wc -l`
[ $OUT -eq 2 ] || fail "Pull method should 'fail' because it is already up-to-date"
success "Pull method should 'fail' because it is already up-to-date"

export PM2_WORKER_INTERVAL=1000

$pm2 kill

$pm2 start ./process.json --name app
sleep 5

#
# Testing refresh-versioning worker
#

OUT=`$pm2 jlist | egrep -oh '"unstaged":true' | wc -c`
[ $OUT -eq 16 ] || fail "Worker: unstaged flag should be true"
success "Worker: unstaged flag should be true"

git add --all
git commit -m 'staged now'
sleep 5
OUT=`$pm2 jlist | egrep -oh '"unstaged":false' | wc -c`
[ $OUT -eq 17 ] || fail "Worker: unstaged flag should be false this time"
success "Worker: unstaged flag should be false this time"

OUT=`$pm2 jlist | egrep -oh '"ahead":true' | wc -c`
[ $OUT -eq 13 ] || fail "Worker: ahead flag should be true"
success "Worker: ahead flag should be true"

OUT=`$pm2 pull app 83dfc32383a84e146005d8981bcae2c52a5b123b | egrep -oh 'Current commit 83dfc32383a84e146005d8981bcae2c52a5b123b' | wc -c`
[ $OUT -eq 56 ] || fail "Commit ID should be correct"
success "Commit ID should be correct"

$pm2 kill
cd ..
rm -rf ./app-playground
