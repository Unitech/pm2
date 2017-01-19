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

mocha --opts ./mocha.opts  ./god.mocha.js
spec "God test"

mocha --opts ./mocha.opts  ./programmatic.js
spec "Programmatic test"

mocha --opts ./mocha.opts  ./containerizer.mocha.js
spec "Dockerfile parser test"

mocha --opts ./mocha.opts  ./api.mocha.js
spec "API tests"
mocha --opts ./mocha.opts  ./path_resolution.mocha.js
spec "API tests"
mocha --opts ./mocha.opts  ./lazy_api.mocha.js
spec "API tests"
mocha --opts ./mocha.opts  ./api.backward.compatibility.mocha.js
spec "API Backward compatibility tests"
mocha --opts ./mocha.opts  ./custom_action.mocha.js
spec "Custom Actions tests"

mocha --opts ./mocha.opts  ./logs.js
spec "Logs test"
mocha --opts ./mocha.opts  ./watcher.js
spec "Watcher"
# mocha --opts ./mocha.opts  ./modularizer.mocha.js
# spec "Module system"
mocha --opts ./mocha.opts  ./max_memory_limit.js
spec "Max memory tests"
mocha --opts ./mocha.opts  ./cluster.mocha.js
spec "Cluster tests"
mocha --opts ./mocha.opts  ./inside.mocha.js
spec "Inside pm2 call tests"
mocha --opts ./mocha.opts  ./misc_commands.js
spec "MISC tests"
mocha --opts ./mocha.opts  ./signals.js
spec "SIGINT signal interception + delay customization"
mocha --opts ./mocha.opts  ./send_data_process.mocha.js
spec "Send data to a process"

mocha --opts ./mocha.opts  ./json_validation.mocha.js
spec "JSON validation test"
mocha --opts ./mocha.opts  ./env_switching.js
spec "JSON environment switching on JSON restart with --env"
mocha --opts ./mocha.opts  ./configuration.mocha.js
spec "Configuration system working"

#
# Interface testing
#
cd ../interface

echo $PM2_HOME

mocha --opts ./mocha.opts  ./exception.e2e.mocha.js
spec "E2E exception system checking"
mocha --opts ./mocha.opts  ./interactor.connect.mocha.js
spec "Interactor test #1 with password setting"
mocha --opts ./mocha.opts  ./interactor.daemonizer.mocha.js
spec "Remote interactor keys save verification"
mocha --opts ./mocha.opts  ./scoped_pm2_actions.mocha.js
spec "Scoped PM2 Remote interactions test"
mocha --opts ./mocha.opts  ./remote.mocha.js
spec "Remote interactions test"
mocha --opts ./mocha.opts  ./password.mocha.js
spec "Password library checking"
mocha --opts ./mocha.opts  ./custom-actions.mocha.js
spec "Custom actions test"
mocha --opts ./mocha.opts  ./bus.spec.mocha.js
spec "Protocol communication test"
mocha --opts ./mocha.opts  ./bus.fork.spec.mocha.js
spec "Protocol communication test"
mocha --opts ./mocha.opts  ./request.mocha.js
spec "Protocol communication test"
mocha --opts ./mocha.opts  ./aggregator.mocha.js
spec "Transaction trace aggregator test"
mocha --opts ./mocha.opts  ./pm2.link.check.mocha.js
spec "Transaction option enablement"
