#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path

## Test #1

$pm2 start append-env-to-name.json --env dev
should 'have started app with name web-dev' "name: 'web-dev'" 3

$pm2 start append-env-to-name.json --env prod
should 'have started same app with name : web-prod' "name: 'web-prod'" 3
