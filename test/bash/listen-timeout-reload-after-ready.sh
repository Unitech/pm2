#!/usr/bin/env bash

#export PM2_GRACEFUL_LISTEN_TIMEOUT=1000

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"
cd $file_path/listen-timeout/

echo -e "\033[1mENV REFRESH\033[0m"

$pm2 start reload-after-ready.js -i 1 --wait-ready --reload-after-ready --listen-timeout 1000
should 'should have started 1 clustered app' 'online' 1

TEST_VAR=THROW $pm2 reload all --update-env
should 'should skip restart of processes when new process crashed' 'restart_time: 0' 1

TEST_VAR=TIMEOUT $pm2 reload all --update-env
should 'should skip restart of processes when new process does not send ready message' 'restart_time: 0' 1

TEST_VAR= $pm2 reload all --update-env
should 'should restart processes when new process is ready' 'restart_time: 1' 1
