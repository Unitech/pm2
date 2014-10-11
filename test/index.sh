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
mocha ./test/programmatic/programmatic.js
spec "Programmatic test"

#mocha ./test/interface/interactor.daemonizer.mocha.js
spec "Interactor daemonizer test"
mocha ./test/interface/bus.spec.mocha.js
spec "Protocol communication test"


echo "########## PROGRAMMATIC TEST DONE #########"
