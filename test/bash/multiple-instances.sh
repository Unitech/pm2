#!/usr/bin/env bash
SRC=$(cd $(dirname "$0"); pwd)
cd $SRC
../../node_modules/.bin/mocha --opts ../mocha.opts ../multiple_instances
