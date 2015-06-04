#!/usr/bin/env bash

alias mocha='../node_modules/mocha/bin/mocha'
pm2="`type -P node` `pwd`/bin/pm2"

# Abort script at first error
set -e
# Display all commands executed
set -o verbose

function fail {
  echo -e "######## \033[31m  ✘ $1\033[0m"
  $pm2 kill
  exit 1
}

function success {
  echo -e "\033[32m------------> ✔ $1\033[0m"
  $pm2 kill
}

function spec {
  [ $? -eq 0 ] || fail "$1"
  success "$1"
}

$pm2 kill

# if [ $TRAVIS ]
# then
#   export DEBUG="pm2:*"
# fi

mocha ./test/programmatic/god.mocha.js
spec "God test"
mocha ./test/programmatic/satan.mocha.js
spec "Satan test"

#
# Programmatic API test
#
mocha ./test/programmatic/programmatic.js
spec "Programmatic test"
mocha ./test/programmatic/logs.js
spec "Logs test"
mocha ./test/programmatic/max_memory_limit.js
spec "Max memory tests"
mocha ./test/programmatic/cluster.js
spec "Cluster tests"
mocha ./test/programmatic/misc_commands.js
spec "MISC tests"


mocha ./test/programmatic/json_validation.mocha.js
spec "JSON validation test"
mocha ./test/programmatic/configuration.mocha.js
spec "Configuration system working"

mocha ./test/interface/interactor.daemonizer.mocha.js
spec "Remote interactor keys save verification"
mocha ./test/interface/remote.mocha.js
spec "Remote interactions test"
mocha ./test/interface/custom-actions.mocha.js
spec "Custom actions test"
mocha ./test/interface/bus.spec.mocha.js
spec "Protocol communication test"
mocha ./test/interface/bus.fork.spec.mocha.js
spec "Protocol communication test"
