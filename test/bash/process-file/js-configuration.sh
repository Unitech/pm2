#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"
cd $file_path/js-configuration

$pm2 start ecosystem.config.js
should 'should have started 1 processes' 'online' 1
