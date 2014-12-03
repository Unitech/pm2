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

# Clean up house
if [ -z $PM2_HOME ]; then
  if [ -z $HOME ]; then
    if [ -z $HOMEPATH ]; then
      ROOT="$HOMEPATH"
    fi
  else
    ROOT="$HOME"
  fi
else
  ROOT="$PM2_HOME"
fi

if [ $ROOT ]; then
  ROOT="$ROOT/.pm2"
  if [ ! -d $ROOT ]; then
    echo "$ROOT does not exist"
  else
    rm -rf "$ROOT"
    echo "$ROOT should be removed"
  fi
else
  echo "have no permission to access pm2 root"
fi

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
mocha ./test/programmatic/json_validation.mocha.js
spec "JSON validation test"

mocha ./test/interface/interactor.daemonizer.mocha.js
spec "Remote interactor keys save verification"
mocha ./test/interface/remote.mocha.js
spec "Remote interactions test"
mocha ./test/interface/bus.spec.mocha.js
spec "Protocol communication test"
mocha ./test/interface/bus.fork.spec.mocha.js
spec "Protocol communication test"

echo "########## PROGRAMMATIC TEST DONE #########"
