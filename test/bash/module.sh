#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

echo -e "\033[1mRunning tests:\033[0m"

cd $file_path

#
# Re init module system
#
rm -rf ~/.pm2/node_modules
$pm2 kill
#
#
#

$pm2 set 'pm2-probe.config1xxx' true

$pm2 install pm2-probe
spec "Should install a module"
should 'should app be online' 'online' 1

ls ~/.pm2/node_modules/pm2-probe
spec "Module should be installed"

#
# Should configuration variable be present two times
# one time in the raw env, and a second time prefixed with the module name
#
OUT=`$pm2 prettylist | grep -o "config1xxx" | wc -l`
[ $OUT -eq 2 ] || fail "$1"
success "$1"

$pm2 update
spec "Should update succesfully"
should 'and module still online' 'online' 1

$pm2 kill
spec "Should kill pm2"

$pm2 list
spec "Should resurrect pm2"
should 'and module still online' 'online' 1


$pm2 stop pm2-probe
should 'should module status not be modified' 'online' 1

$pm2 delete all
should 'should module status not be modified' 'online' 1

$pm2 delete pm2-probe
should 'should module status not be modified' 'online' 1

$pm2 stop all
should 'should module status not be modified' 'online' 1

$pm2 stop pm2-probe
should 'should module status not be modified' 'online' 1

$pm2 uninstall pm2-probe
spec "Should uninstall a module"
should 'should module not be online' 'online' 0

ls ~/.pm2/node_modules/pm2-probe
ispec "Module should be installed"

$pm2 update
should 'should module not be online' 'online' 0
