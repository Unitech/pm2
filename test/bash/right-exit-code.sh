#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

cd $file_path

echo -e "\033[1mRIGHT EXIT CODES:\033[0m"


$pm2 kill

$pm2 restart BULLSHIT
ispec "Unknown process = error exit"

$pm2 restart 666
ispec "Unknown process = error exit"

$pm2 restart all
ispec "No process = error exit"

$pm2 stop all
ispec "No process = error exit"

$pm2 delete 10
ispec "No process = error exit"

$pm2 delete toto
ispec "No process = error exit"
