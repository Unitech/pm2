#!/bin/bash

export NODE_ENV='test'

function fail {
  echo -e "######## \033[31m  ✘ $1\033[0m"
}

function success {
  echo -e "\033[32m------------> ✔ $1\033[0m"
}

function spec {
  [ $? -eq 0 ] || fail "$1"
  success "$1"
}

pkill -f PM2

cd test/

parallel --gnu --keep-order --joblog joblog --halt now,fail=1 -j+0 < programmatic_commands.txt
spec "Should text have passed"
cat joblog

# possible to pass --tmux
