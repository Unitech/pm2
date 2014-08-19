#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

cd $file_path

echo "################## GRACEFUL RELOAD ###################"

###############

echo "Launching"
$pm2 start graceful-exit.js -i 4 --name="graceful" -o "grace.log" -e "grace-err.log"
should 'should start processes' 'online' 4

OUT_LOG=`$pm2 prettylist | grep -m 1 -E "pm_out_log_path:" | sed "s/.*'\([^']*\)',/\1/"`
cat /dev/null > $OUT_LOG

#### Graceful reload all

$pm2 gracefulReload all

OUT=`grep "Finished closing connections" "$OUT_LOG" | wc -l`
[ $OUT -eq 1 ] || fail "Process not restarted gracefuly"
success "Process restarted gracefuly"


cat /dev/null > $OUT_LOG

#### Graceful reload name
$pm2 gracefulReload graceful

OUT=`grep "Finished closing connections" "$OUT_LOG" | wc -l`
[ $OUT -eq 1 ] || fail "Process not restarted gracefuly"
success "Process restarted gracefuly"

$pm2 kill
