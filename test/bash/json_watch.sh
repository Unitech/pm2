#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

cd $file_path

function waituntil {
  for (( i = 0; i <= $1; i++ )); do
      sleep 0.2
      echo -n "."
  done
  echo ""
}

function reset_watch_dir {
  rm watch/app1/server.js
  cp watch/app1/server.bak.js watch/app1/server.js
  rm watch/app2/server.js
  cp watch/app2/server.bak.js watch/app2/server.js
  rm watch/lib/external_file.js
  touch watch/lib/external_file.js
}

$pm2 kill

echo -e "\033[1mRunning tests:\033[0m"

reset_watch_dir

###################
# JSON watch test #
###################
# lets make sure watch over multiple processes and directories using JSON declaration works

cat watch.json

$pm2 start watch.json

echo "console.log('test');" >> watch/app1/server.js

sleep 1

cat watch/app1/server.js

$pm2 list

should 'processes should have been restarted' 'restart_time: 1' 1
should 'processes should be online' "status: 'online'" 2

$pm2 kill

reset_watch_dir

$pm2 start watch.json

echo "console.log('test');" >> watch/app2/server.js

sleep 1

cat watch/app2/server.js

$pm2 list

should 'processes should have been restarted' 'restart_time: 1' 1
should 'processes should be online' "status: 'online'" 2

$pm2 kill

reset_watch_dir

# now check watching a file outside of cwd

cat watch.json

$pm2 start watch.json

echo "console.log('test');" >> watch/lib/external_file.js

sleep 1

cat watch/lib/external_file.js

$pm2 list

should 'processes should have been restarted' 'restart_time: 1' 2
should 'processes should be online' "status: 'online'" 2

$pm2 kill

reset_watch_dir
