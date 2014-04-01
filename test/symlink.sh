#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

echo -e "\033[1mRunning tests:\033[0m"



echo "####################### DEBUG ############################"
echo "PM2 Command = " $pm2
echo "Node version = " $nodeVersion
$node -e "var os = require('os'); console.log('arch : %s\nplatform : %s\nrelease : %s\ntype : %s\nmem : %d', os.arch(), os.platform(), os.release(), os.type(), os.totalmem())"
echo "###################### !DEBUG! ###########################"

cd $file_path

$pm2 kill

$pm2 start symlink-server.js

should 'app should be online' 'online' 1

$pm2 stop