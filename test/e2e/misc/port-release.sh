#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"
cd $file_path

$pm2 start cluster-pm2.json
should 'should have started 4 processes' 'online' 4

$pm2 reload cluster-pm2.json
should 'should have started 4 processes' 'online' 4
