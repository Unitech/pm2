#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path/watch

$pm2 start http.js --watch
should '1 should watch be false' 'watch: true' 1

$pm2 stop http
should '2 should watch be false when stopping app' 'watch: false' 1

$pm2 start http
should '3 should watch be false when starting app' 'watch: false' 1

$pm2 restart http.js
should '4 should restart with watch and should be false' 'watch: false' 1

$pm2 delete http

$pm2 start http.js
should '5 should watch be false' 'watch: false' 1

$pm2 stop http.js
should '5 should watch be false' 'watch: false' 1

$pm2 start http.js --watch
should '7 should restart with watch and should be true' 'watch: true' 1

$pm2 delete all

$pm2 start http.js
should '8 should watch be false' 'watch: false' 1

$pm2 restart http.js
should '6 should watch be false' 'watch: false' 1

$pm2 restart http.js --watch
should '7 should restart with watch and should be true' 'watch: true' 1

$pm2 restart http.js --watch
should '8 should restart with watch and should be false' 'watch: false' 1

$pm2 restart http.js --watch
should '9 should restart with watch and should be true' 'watch: true' 1

$pm2 stop http.js
should '10 should stop app and watch is stopped' 'watch: false' 1

$pm2 restart http.js --watch
should '11 should restart stopped app with watch and should be true' 'watch: true' 1

$pm2 restart http.js --watch
should '12 should restart with watch and should be false' 'watch: false' 1

$pm2 kill

$pm2 start app.json
should 'should have started 1 apps' 'online' 1
should 'should have restarted app by name' 'restart_time: 0' 1
should 'should watch be false' 'watch: false' 1

$pm2 restart app.json
should 'should have started 1 apps' 'online' 1
should 'should have restarted app by name' 'restart_time: 1' 1
should 'should watch be false' 'watch: false' 1

$pm2 stop app.json
should 'should have started 1 apps' 'stopped' 1
should 'should have restarted app by name' 'restart_time: 1' 1
should 'should watch be false' 'watch: false' 1

$pm2 kill

$pm2 start app-watch.json
should 'should have started 1 apps' 'online' 1
should 'should have restarted app by name' 'restart_time: 0' 1
should 'should watch exist' 'watch: true' 1

$pm2 stop app-watch.json
should 'should have started 1 apps' 'stopped' 1
should 'should have restarted app by name' 'restart_time: 0' 1
should 'should watch exist' 'watch: false' 1

$pm2 restart app-watch.json
should 'should have started 1 apps' 'online' 1
should 'should have restarted app by name' 'restart_time: 0' 1
should 'should watch exist' 'watch: true' 1

$pm2 restart all
should 'should have started 1 apps' 'online' 1
should 'should have restarted app by name' 'restart_time: 1' 1
should 'should watch exist' 'watch: true' 1

$pm2 stop all
should 'should have started 1 apps' 'stopped' 1
should 'should have restarted app by name' 'restart_time: 1' 1
should 'should watch exist' 'watch: false' 1
