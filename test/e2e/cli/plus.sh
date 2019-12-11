#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path

$pm2 start echo.js
$pm2 prettylist | grep "km_link: false"
spec "should km_link not be enabled"

$pm2 plus alcz82ewyhy2va6 litfrsovr52celr --install-all

should 'have started 3 apps' 'online' 3
should 'all application be monitored' 'km_link: true' 3

$pm2 plus delete

should 'have started 1 apps' 'online' 1
$pm2 prettylist | grep "km_link: false"
spec "should km_link be disabled"
