#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

cd $file_path

$pm2 startup systemd -u $USER --hp $HOME
sleep 2
$pm2 ls
$pm2 kill

$pm2 unstartup systemd
