#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

echo -e "\033[1mRunning tests:\033[0m"

cd $file_path

#
# Re init module system
#
$pm2 kill
rm -rf ~/.pm2
#
#
#
$pm2 ls
$pm2 install pm2-sample-module@2.1.0
spec "Should have installed module"

sleep 1
should 'should have started module' 'online' 1
should 'should module be in stable state' 'restart_time: 0' 1
should 'should module be on the right version' "module_version: '2.1.0'" 1

$pm2 install pm2-sample-module@2.0.0 --safe
ispec "Should installation of unstable module fail (npm installation has failed)"
should 'should have restored module to previous version and online' 'online' 1
should 'should module be in stable state' 'restart_time: 0' 1
should 'should module be on the right version' "module_version: '2.1.0'" 1

$pm2 install pm2-sample-module@2.2.0 --safe
ispec "Should installation of unstable module fail (module bad behavior (restart))"
should 'should have restored module to previous version and online' 'online' 1
should 'should module be in stable state' 'restart_time: 0' 1
should 'should module be on the right version' "module_version: '2.1.0'" 1

#
# Test edge cases
#
$pm2 uninstall all
spec "Should have uninstalled all modules"

$pm2 install pm2-sample-module@2.2.0 --safe
