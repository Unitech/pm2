#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

echo -e "\033[1mTreeKill.sh:\033[0m"

cd $file_path

cleanup() {
  # Killing the launched processes
  ps -ef|grep 'tail -F ./childrens.log'|grep -v grep|awk '{print $2}'|xargs kill -9
  ps -ef|grep 'tail -F ./childrensdetached.log'|grep -v grep|awk '{print $2}'|xargs kill -9
  rm childrens.log childrensdetached.log
}

###############
$pm2 kill

echo "Starting and stoping a process which has child"
echo "We're testing that childs are beeing killed even detached"

echo "Some logs" >> childrens.log
echo "Some logs" >> childrensdetached.log

$pm2 start childrens.js

$pm2 stop childrens.js

OUT=`ps -ef|grep 'tail -F ./childrens.log'|grep -v grep|wc -l`

if [ $OUT -eq 0 ]
then
    success "Killed the child process!"
else
    cleanup
    fail "Failed to kill the child process"
fi

OUT=`ps -ef|grep 'tail -F ./childrensdetached.log'|grep -v grep|wc -l`

if [ $OUT -eq 0 ]
then
    success "We killed the child process"
else
    cleanup
    fail "Failed to kill the child process"
fi

$pm2 kill

echo "Now let's enable --no-treekill"

$pm2 start childrens.js --no-treekill

$pm2 stop childrens.js

OUT=`ps -ef|grep 'tail -F ./childrens.log'|grep -v grep|wc -l`

ps -ef | grep 'tail -F'
if [ $OUT -eq 0 ]
then
    success "Killed the child process!"
else
    cleanup
    fail "Failed to kill the child process"
fi

OUT=`ps -ef|grep 'tail -F ./childrensdetached.log'|grep -v grep|wc -l`

if [ $OUT -eq 1 ]
then
    success "We didn't killed the child process"
else
    cleanup
    fail "Failed not to kill the child process"
fi

cleanup
