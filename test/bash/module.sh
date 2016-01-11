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

$pm2 set 'pm2-probe:config1xxx' true

$pm2 install pm2-probe
spec "Should install a module"
should 'should app be online' 'online' 1

$pm2 install pm2-probe
spec "Should update a module"
should 'should app be online' 'online' 1

ls ~/.pm2/node_modules/pm2-probe
spec "Module should be installed"

#
# Should configuration variable be present two times
# one time in the raw env, and a second time prefixed with the module name
#
exists 'should have config variable' "config1xxx: 'true'" 4

#
# Change variable value
#

$pm2 set 'pm2-probe:config1xxx' false

sleep 1

exists 'should have config variable' "config1xxx: 'false'" 4

$pm2 update
spec "Should update successfully"
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

#
# Module test
#

cd module-fixture

$pm2 kill

# Unset all possible variables for module
$pm2 unset example-module

# Install local module in development mode
$pm2 install .
sleep 0.5
spec 'Should have installed module'

# Default configuration variable in package.json (under "config" attribute)
# Only 2 occurences because this is the first start
should 'should have config variable' "var2: false" 2

# Override environment variable
$pm2 set example-module:var2 true
sleep 0.5
should 'should module been restarted after setting variable' 'restart_time: 1' 1

# 4 occurences because of a restart
should 'should have config variable modified' "var2: 'true'" 4

$pm2 set example-module:newvar true
sleep 0.5
should 'should module been restarted after setting variable' 'restart_time: 2' 1

# 4 occurences because of a restart
should 'should have config variable modified' "newvar: 'true'" 4
