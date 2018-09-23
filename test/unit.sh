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
    $pm2 uninstall all
    $pm2 link delete
    $pm2 kill
    success "$1"
}

$pm2 uninstall all

# if [ $TRAVIS ]
# then
#   export DEBUG="pm2:*"
# fi
cd test/programmatic

mocha --exit --opts ./mocha.opts  ./programmatic.js
spec "Programmatic test"

mocha --exit --opts ./mocha.opts  ./containerizer.mocha.js
spec "Dockerfile parser test"

mocha --exit --opts ./mocha.opts  ./api.mocha.js
spec "API tests"
mocha --exit --opts ./mocha.opts  ./path_resolution.mocha.js
spec "API tests"
mocha --exit --opts ./mocha.opts  ./lazy_api.mocha.js
spec "API tests"
mocha --exit --opts ./mocha.opts  ./reload-locker.mocha.js
spec "Reload locker tests"

mocha --exit --opts ./mocha.opts  ./api.backward.compatibility.mocha.js
spec "API Backward compatibility tests"
mocha --exit --opts ./mocha.opts  ./custom_action.mocha.js
spec "Custom Actions tests"

mocha --exit --opts ./mocha.opts  ./logs.js
spec "Logs test"
mocha --exit --opts ./mocha.opts  ./watcher.js
spec "Watcher"
mocha --exit --opts ./mocha.opts  ./max_memory_limit.js
spec "Max memory tests"
# mocha --exit --opts ./mocha.opts  ./module_configuration.mocha.js
# spec "Max memory tests"
mocha --exit --opts ./mocha.opts  ./cluster.mocha.js
spec "Cluster tests"
mocha --exit --opts ./mocha.opts  ./graceful.mocha.js
spec "Graceful tests"
mocha --exit --opts ./mocha.opts  ./inside.mocha.js
spec "Inside pm2 call tests"
mocha --exit --opts ./mocha.opts  ./misc_commands.js
spec "MISC tests"
mocha --exit --opts ./mocha.opts  ./signals.js
spec "SIGINT signal interception + delay customization"
mocha --exit --opts ./mocha.opts  ./send_data_process.mocha.js
spec "Send data to a process"
mocha --exit --opts ./mocha.opts  ./modules.mocha.js
spec "Module API testing"
# mocha --exit --opts ./mocha.opts  ./module_retrocompat.mocha.js
# spec "Module retrocompatibility system"

mocha --exit --opts ./mocha.opts  ./json_validation.mocha.js
spec "JSON validation test"
mocha --exit --opts ./mocha.opts  ./env_switching.js
spec "JSON environment switching on JSON restart with --env"
mocha --exit --opts ./mocha.opts  ./configuration.mocha.js
spec "Configuration system working"
mocha --exit --opts ./mocha.opts  ./id.mocha.js
spec "Uniqueness id for each process"

mocha --exit --opts ./mocha.opts  ./god.mocha.js
spec "God test"


#
# Interface testing
#
cd ../interface

# echo $PM2_HOME

mocha --exit --opts ./mocha.opts  ./bus.spec.mocha.js
spec "Protocol communication test"
mocha --exit --opts ./mocha.opts  ./bus.fork.spec.mocha.js
spec "Protocol communication test"
mocha --exit --opts ./mocha.opts  ./utility.mocha.js
spec "PM2 Utility"
