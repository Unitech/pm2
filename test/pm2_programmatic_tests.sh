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
  sleep 0.5
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

mocha ./test/programmatic/programmatic.js
spec "Programmatic test"
mocha ./test/programmatic/logs.js
spec "Logs test"
mocha ./test/programmatic/watcher.js
spec "Watcher"
mocha ./test/programmatic/modularizer.mocha.js
spec "Module system"
mocha ./test/programmatic/max_memory_limit.js
spec "Max memory tests"
mocha ./test/programmatic/cluster.js
spec "Cluster tests"
mocha ./test/programmatic/misc_commands.js
spec "MISC tests"
mocha ./test/programmatic/signals.js
spec "SIGINT signal interception + delay customization"
mocha ./test/programmatic/send_data_process.mocha.js
spec "Send data to a process"

mocha ./test/programmatic/json_validation.mocha.js
spec "JSON validation test"
mocha ./test/programmatic/env_switching.js
spec "JSON environment switching on JSON restart with --env"
mocha ./test/programmatic/configuration.mocha.js
spec "Configuration system working"

#
# Interface testing
#
mocha ./test/interface/interactor.connect.mocha.js
spec "Interactor test #1 with password setting"
mocha ./test/interface/interactor.daemonizer.mocha.js
spec "Remote interactor keys save verification"
mocha ./test/interface/scoped_pm2_actions.mocha.js
spec "Scoped PM2 Remote interactions test"
mocha ./test/interface/remote.mocha.js
spec "Remote interactions test"
mocha ./test/interface/password.mocha.js
spec "Password library checking"
mocha ./test/interface/custom-actions.mocha.js
spec "Custom actions test"
mocha ./test/interface/bus.spec.mocha.js
spec "Protocol communication test"
mocha ./test/interface/bus.fork.spec.mocha.js
spec "Protocol communication test"
mocha ./test/interface/request.mocha.js
spec "Protocol communication test"
mocha ./test/interface/push_interactor.mocha.js
spec "Push Interactor + Reconnection communication test"
