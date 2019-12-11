#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path

#
# Re init module system
#
rm -rf ~/.pm2/node_modules
$pm2 kill
#
#
#

$pm2 unset pm2-probe

$pm2 set 'pm2-probe:config1xxx' true

$pm2 install pm2-probe@latest
spec "Should install a module"
should 'should app be online' 'online' 1

$pm2 install pm2-probe@latest
spec "Should update a module"
should 'should app be online' 'online' 1

ls ~/.pm2/modules/pm2-probe
spec "Module should be installed"


# Default configuration variable in package.json (under "config" attribute)
should 'should have default config variable via package.json' "var2: false" 4

#
# Should configuration variable be present two times
# one time in the raw env, and a second time prefixed with the module name
#
exists '1# should have config variable' "config1xxx: 'true'" 6

#
# Change variable value
#

$pm2 set 'pm2-probe:config1xxx' false

sleep 1

exists '2# should have config variable' "config1xxx: 'false'" 4

$pm2 update
spec "Should update successfully"
should 'and module still online' 'online' 1

$pm2 kill
spec "Should kill pm2"

$pm2 list
spec "Should resurrect pm2"
should 'and module still online' 'online' 1


$pm2 delete all
should 'should module status not be modified' 'online' 1

$pm2 stop all
should 'should module status not be modified' 'online' 1

$pm2 stop pm2-probe
should 'should module be possible to stop' 'stopped' 1

$pm2 uninstall pm2-probe
spec "Should uninstall a module"
should 'should module not be online' 'online' 0

ls ~/.pm2/modules/pm2-probe
ispec "Module should be deleted"

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


# # Override environment variable
# $pm2 set example-module:var2 true
# sleep 0.5
# should 'should module been restarted after setting variable' 'restart_time: 1' 1

# # 4 occurences because of a restart
# should 'should have config variable modified' "var2: 'true'" 4

# $pm2 set example-module:newvar true
# sleep 0.5
# should 'should module been restarted after setting variable' 'restart_time: 2' 1

# # 4 occurences because of a restart
# should 'should have config variable modified' "newvar: 'true'" 4
