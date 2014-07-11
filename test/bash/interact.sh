#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"
cd $file_path

echo -e "\033[1mRunning Interaction tests:\033[0m"

$pm2 killInteract

$pm2 interact

$pm2 interact XXX2 XXX3 homeloc

$pm2 updatePM2

$pm2 killInteract

$pm2 interact

$pm2 infoInteract

$pm2 infoInteract | grep "XXX2"
spec "Should have XXX2 has public key"

$pm2 infoInteract | grep "XXX3"
spec "Should have XXX3 has public key"

$pm2 list

$pm2 killInteract
$pm2 kill
