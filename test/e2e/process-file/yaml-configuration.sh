#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"
cd $file_path/yaml-configuration

$pm2 start non-existent.yaml
should 'should have started 0 processes because file unknown' 'online' 0

$pm2 start malformated.yml
should 'should have started 0 processes because file malformated' 'online' 0

$pm2 start apps.yaml
should 'should have started 6 processes' 'online' 6

$pm2 restart all
should 'should have restarted 6 processes' 'restart_time: 1' 6

$pm2 restart apps.yaml
should 'should have restarted 6 processes' 'restart_time: 2' 6

$pm2 reload all
should 'should have reloaded 6 processes' 'restart_time: 3' 6

$pm2 reload apps.yaml
should 'should have reloaded 6 processes' 'restart_time: 4' 6

$pm2 stop all
should 'should have reloaded 6 processes' 'stopped' 6

$pm2 start apps.yaml
$pm2 delete all
should 'should have deleted 6 processes' 'online' 0
