
#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path/increment-var/

$pm2 delete all

echo '-------- CLUSTER MODE TEST -------'

$pm2 start ecosystem.json --only sample-normal

should "start 2 processes" "online" 2
should "start one process with NODE_APP_INSTANCE at 0" "NODE_APP_INSTANCE: 0" 1
should "start one process with NODE_APP_INSTANCE at 1" "NODE_APP_INSTANCE: 1" 1
should "not start one process with NODE_APP_INSTANCE at 2" "NODE_APP_INSTANCE: 2" 0

$pm2 scale sample-normal 4

should "start 2 more processes" "online" 4
should "start one process with NODE_APP_INSTANCE at 0" "NODE_APP_INSTANCE: 0" 1
should "start one process with NODE_APP_INSTANCE at 1" "NODE_APP_INSTANCE: 1" 1
should "start one process with NODE_APP_INSTANCE at 2" "NODE_APP_INSTANCE: 2" 1
should "start one process with NODE_APP_INSTANCE at 3" "NODE_APP_INSTANCE: 3" 1
should "not start one process with NODE_APP_INSTANCE at 4" "NODE_APP_INSTANCE: 4" 0

$pm2 scale sample-normal 2

should "deleted 2 more processes" "online" 2
should "not have the process with NODE_APP_INSTANCE at 0" "NODE_APP_INSTANCE: 0" 0
should "not have the process with NODE_APP_INSTANCE at 1" "NODE_APP_INSTANCE: 1" 0
should "have one process with NODE_APP_INSTANCE at 2" "NODE_APP_INSTANCE: 2" 1
should "have one process with NODE_APP_INSTANCE at 3" "NODE_APP_INSTANCE: 3" 1

$pm2 scale sample-normal 4

should "start 2 more processes" "online" 4
should "should reuse old number with NODE_APP_INSTANCE at 0" "NODE_APP_INSTANCE: 0" 1
should "should reuse old number with NODE_APP_INSTANCE at 1" "NODE_APP_INSTANCE: 1" 1
should "have one process with NODE_APP_INSTANCE at 2" "NODE_APP_INSTANCE: 2" 1
should "have one process with NODE_APP_INSTANCE at 3" "NODE_APP_INSTANCE: 3" 1
should "not have the process with NODE_APP_INSTANCE at 4" "NODE_APP_INSTANCE: 4" 0
should "not have the process with NODE_APP_INSTANCE at 5" "NODE_APP_INSTANCE: 5" 0

$pm2 delete all

$pm2 start ecosystem.json --only sample-other-instance

should "start 2 processes" "online" 2
should "not have deleted the process with NODE_APP_INSTANCE at 0" "NODE_APP_INSTANCE: 0" 0
should "not have deleted the process with NODE_APP_INSTANCE at 1" "NODE_APP_INSTANCE: 1" 0
should "start one process with APP_ID at 0" "APP_ID: 0" 1
should "start one process with APP_ID at 1" "APP_ID: 1" 1

$pm2 delete all

$pm2 start ecosystem.json --only sample-increment

should "start 2 processes" "online" 2
should "start one process with NODE_APP_INSTANCE at 0" "NODE_APP_INSTANCE: 0" 1
should "start one process with NODE_APP_INSTANCE at 1" "NODE_APP_INSTANCE: 1" 1
should "start one process with PORT at 3000" "PORT: 3000" 2
should "start one process with PORT at 3001" "PORT: 3001" 2

$pm2 delete all

echo '-------- FORK MODE TEST -------'

$pm2 start ecosystem.json --only sample-normal-fork

should "start 2 processes" "online" 2
should "start one process with NODE_APP_INSTANCE at 0" "NODE_APP_INSTANCE: 0" 1
should "start one process with NODE_APP_INSTANCE at 1" "NODE_APP_INSTANCE: 1" 1
should "not start one process with NODE_APP_INSTANCE at 2" "NODE_APP_INSTANCE: 2" 0

$pm2 scale sample-normal-fork 4

should "start 2 more processes" "online" 4
should "start one process with NODE_APP_INSTANCE at 0" "NODE_APP_INSTANCE: 0" 1
should "start one process with NODE_APP_INSTANCE at 1" "NODE_APP_INSTANCE: 1" 1
should "start one process with NODE_APP_INSTANCE at 2" "NODE_APP_INSTANCE: 2" 1
should "start one process with NODE_APP_INSTANCE at 3" "NODE_APP_INSTANCE: 3" 1
should "not start one process with NODE_APP_INSTANCE at 4" "NODE_APP_INSTANCE: 4" 0

$pm2 scale sample-normal-fork 2

should "deleted 2 more processes" "online" 2
should "not have the process with NODE_APP_INSTANCE at 0" "NODE_APP_INSTANCE: 0" 0
should "not have the process with NODE_APP_INSTANCE at 1" "NODE_APP_INSTANCE: 1" 0
should "have one process with NODE_APP_INSTANCE at 2" "NODE_APP_INSTANCE: 2" 1
should "have one process with NODE_APP_INSTANCE at 3" "NODE_APP_INSTANCE: 3" 1

$pm2 scale sample-normal-fork 4

should "start 2 more processes" "online" 4
should "should reuse old number with NODE_APP_INSTANCE at 0" "NODE_APP_INSTANCE: 0" 1
should "should reuse old number with NODE_APP_INSTANCE at 1" "NODE_APP_INSTANCE: 1" 1
should "have one process with NODE_APP_INSTANCE at 2" "NODE_APP_INSTANCE: 2" 1
should "have one process with NODE_APP_INSTANCE at 3" "NODE_APP_INSTANCE: 3" 1
should "not have the process with NODE_APP_INSTANCE at 4" "NODE_APP_INSTANCE: 4" 0
should "not have the process with NODE_APP_INSTANCE at 5" "NODE_APP_INSTANCE: 5" 0

$pm2 delete all

$pm2 start ecosystem.json --only sample-other-instance-fork

should "start 2 processes" "online" 2
should "not have deleted the process with NODE_APP_INSTANCE at 0" "NODE_APP_INSTANCE: 0" 0
should "not have deleted the process with NODE_APP_INSTANCE at 1" "NODE_APP_INSTANCE: 1" 0
should "start one process with APP_ID at 0" "APP_ID: 0" 1
should "start one process with APP_ID at 1" "APP_ID: 1" 1

$pm2 delete all

$pm2 start ecosystem.json --only sample-increment-fork

should "start 2 processes" "online" 2
should "start one process with NODE_APP_INSTANCE at 0" "NODE_APP_INSTANCE: 0" 1
should "start one process with NODE_APP_INSTANCE at 1" "NODE_APP_INSTANCE: 1" 1
should "start one process with PORT at 3000" "PORT: 3000" 2
should "start one process with PORT at 3001" "PORT: 3001" 2
