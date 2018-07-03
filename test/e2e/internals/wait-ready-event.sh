#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path/wait_ready_event

##### start with sending event and without waiting (fork mode)
$pm2 start http-wait-start.js
should 'should have started 1 forked app' 'online' 1
$pm2 delete all

##### start with sending event and ask to wait (fork mode)
$pm2 start http-wait-start.js --wait-ready
should 'should have started 1 forked app' 'online' 1
$pm2 delete all

##### start without sending event and without waiting (fork mode)
$pm2 start http-wait-start.js
should 'should have started 1 forked app ' 'online' 1
$pm2 delete all

##### start without sending event and ask to wait (fork mode)
$pm2 start http-wait-start_nocb.js --wait-ready --listen-timeout=8000 &
sleep 5
should 'should be 1 forked launching state app waiting for ready event' 'launching' 1
$pm2 delete all

##### start with sending event and without waiting (cluster mode)
$pm2 start http-wait-start.js -i 1
should 'should have started 1 clustered app' 'online' 1
$pm2 delete all

##### start with sending event and ask to wait (cluster mode)
$pm2 start http-wait-start.js -i 1 --wait-ready
should 'should have started 1 clustered app' 'online' 1
$pm2 delete all

##### start without sending event and without waiting (cluster mode)
$pm2 start http-wait-start.js -i 1
should 'should have started 1 clustered app' 'online' 1
$pm2 delete all

##### start without sending event and ask to wait (cluster mode)
$pm2 start http-wait-start_nocb.js -i 1 --wait-ready --listen-timeout=8000 &
sleep 5
should 'should be 1 clustered launching state app waiting for ready event' 'launching' 1
$pm2 delete all
