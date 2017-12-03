#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

echo -e "\033[1mRunning tests:\033[0m"

cd $file_path

#
# Re init module system
#
rm -rf ~/.pm2/node_modules
rm -rf ~/.pm2/modules
$pm2 kill
#
#
#

$pm2 install pm2-probe --v1
