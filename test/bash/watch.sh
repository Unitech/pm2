#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

cd $file_path/watch

$pm2 start app.json
should 'should have started 1 apps' 'online' 1
should 'should have restarted app by name' 'restart_time: 0' 1
should 'should watch be false' 'watch: false' 2

$pm2 restart app.json
should 'should have started 1 apps' 'online' 1
should 'should have restarted app by name' 'restart_time: 1' 1
should 'should watch be false' 'watch: false' 2

# $pm2 restart app.json --watch
# should 'should have started 1 apps' 'online' 1
# should 'should have restarted app by name' 'restart_time: 2' 1
# should 'should watch be false' 'watch: true' 2

$pm2 kill

$pm2 start http.js
should 'should have started 1 apps' 'online' 1
should 'should have restarted app by name' 'restart_time: 0' 1
should 'should watch be false' 'watch: false' 1

$pm2 restart http.js
should 'should have started 1 apps' 'online' 1
should 'should have restarted app by name' 'restart_time: 1' 1
should 'should watch be false' 'watch: false' 1

$pm2 restart http.js --watch
should 'should have started 1 apps' 'online' 1
should 'should have restarted app by name' 'restart_time: 2' 1
should 'should watch exist' 'watch: \[]' 2
