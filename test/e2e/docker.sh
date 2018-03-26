#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

# Docker should
function dshould {
    sleep 0.3
    CID=`docker ps -lq`
    docker exec -it $CID /bin/sh -c "PM2_HOME=/root/.pm2-dev/ pm2 prettylist" > /tmp/dout
    OUT=`cat /tmp/dout | grep -o "$2" | wc -l`
    [ $OUT -eq $3 ] || fail "$1"
    success "$1"
}

function PRODshould {
    sleep 0.3
    CID=`docker ps -lq`
    docker exec -it $CID /bin/sh -c "pm2 prettylist" > /tmp/dout
    OUT=`cat /tmp/dout | grep -o "$2" | wc -l`
    [ $OUT -eq $3 ] || fail "$1"
    success "$1"
}

# Bootstrap one app
cd $file_path/docker/expressor

# Kill all running container
docker kill `docker ps -aq -f status=running`
rm Dockerfile
rm -rf node_modules

################### DEV MODE
#
# Wrap Application in Development mode
#
$pm2 start process.json --dockerdaemon --container
CID=`docker ps -lq`

# Check Dockerfile generation
ls Dockerfile
spec "Dockerfile have been generated"

grep "process.json" Dockerfile
spec "Right entry file"

sleep 1
# Check running processes inside container
dshould 'should have started 2 apps' 'online' 2
dshould 'should the 2 apps not being restarted' 'restart_time: 0' 2

docker kill $CID

#
# Edit Dockerfile (simulate user who needs a specific library)
#
sed -i '' '5i\
RUN pm2 install pm2-server-monit
' Dockerfile

$pm2 start process.json --dockerdaemon --container
sleep 1
grep "RUN pm2 install pm2-server-monit" Dockerfile
spec "Custom line should still be present"
dshould 'should have started 2 apps' 'online' 2
dshould 'should the 2 apps be stable' 'restart_time: 0' 2

docker kill `docker ps -lq`

################### DISTRIBUTION MODE
#
# Wrap Application in Distribution mode
#
$pm2 start process.json --container --dist --image-name pm2ns/test --dockerdaemon
sleep 2
grep "RUN pm2 install pm2-server-monit" Dockerfile
spec "Custom line should still be present"

PRODshould 'should have started 3 apps (2 user app + one module)' 'online' 3

docker kill `docker ps -lq`
rm Dockerfile

# Re wrap with new generated Dockerfile
$pm2 start process.json  --container --dist --image-name pm2ns/test --dockerdaemon
sleep 1
PRODshould 'should have started 2 apps' 'online' 2
PRODshould 'should the 2 apps not being restarted' 'restart_time: 0' 2
grep "pm2-docker" Dockerfile
spec "pm2-docker runtime should be present"

# Exit
docker kill `docker ps -lq`
rm Dockerfile
