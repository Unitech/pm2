#!/usr/bin/env bash

alias mocha='../node_modules/mocha/bin/mocha'
pm2="`type -P node` `pwd`/bin/pm2"

# Abort script at first error
set -e
# Display all commands executed
set -o verbose

function fail {
  echo -e "######## \033[31m  ✘ $1\033[0m"
  exit 1
}

function success {
  echo -e "\033[32m------------> ✔ $1\033[0m"
}

function spec {
  [ $? -eq 0 ] || fail "$1"
  success "$1"
}



# if [ $TRAVIS ]
# then
#   export DEBUG="pm2:*"
# fi
cd test/programmatic

mocha ./god.mocha.js
spec "God test"

mocha ./programmatic.js
spec "Programmatic test"
mocha ./logs.js
spec "Logs test"
mocha ./watcher.js
spec "Watcher"
# mocha ./modularizer.mocha.js
# spec "Module system"
mocha ./max_memory_limit.js
spec "Max memory tests"
mocha ./cluster.mocha.js
spec "Cluster tests"
mocha ./misc_commands.js
spec "MISC tests"
mocha ./signals.js
spec "SIGINT signal interception + delay customization"
mocha ./send_data_process.mocha.js
spec "Send data to a process"
mocha ./return.mocha.js
spec "Verify return messages"

mocha ./json_validation.mocha.js
spec "JSON validation test"
mocha ./env_switching.js
spec "JSON environment switching on JSON restart with --env"
mocha ./configuration.mocha.js
spec "Configuration system working"

#
# Interface testing
#
cd ../interface

echo $PM2_HOME

mocha ./interactor.connect.mocha.js
spec "Interactor test #1 with password setting"
mocha ./interactor.daemonizer.mocha.js
spec "Remote interactor keys save verification"
mocha ./scoped_pm2_actions.mocha.js
spec "Scoped PM2 Remote interactions test"
mocha ./remote.mocha.js
spec "Remote interactions test"
mocha ./password.mocha.js
spec "Password library checking"
mocha ./custom-actions.mocha.js
spec "Custom actions test"
mocha ./bus.spec.mocha.js
spec "Protocol communication test"
mocha ./bus.fork.spec.mocha.js
spec "Protocol communication test"
mocha ./request.mocha.js
spec "Protocol communication test"
