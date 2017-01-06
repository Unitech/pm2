#!/usr/bin/env bash

if [ "$EUID" -ne 0 ]
then
    echo "Please run as root"
    exit
fi

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

cd $file_path

$pm2 startup upstart -u $USER --hp $HOME
spec "should startup command generation exited succesfully"
test -e /etc/init.d/pm2
spec "should have generated upstart file"
$pm2 unstartup upstart
spec "should have disabled startup"
! test -e /etc/init.d/pm2
spec "should have deleted upstart file"
