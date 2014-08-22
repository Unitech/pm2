#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

cd $file_path

echo "################## GRACEFUL RELOAD 3 ###################"

###############

echo "Launching"
$pm2 start graceful-exit-send.js -i 2 --name="graceful3" -o "grace3.log" -e "grace-err3.log"
should 'should start processes' 'online' 2

OUT_LOG=`$pm2 prettylist | grep -m 1 -E "pm_out_log_path:" | sed "s/.*'\([^']*\)',/\1/"`
cat /dev/null > $OUT_LOG

#### Graceful reload name
$pm2 gracefulReload graceful3

OUT=`grep "Finished closing connections" "$OUT_LOG" | wc -l`
[ $OUT -eq 1 ] || fail "Process that sends 'online' not restarted gracefuly"
success "Process that sends 'online' restarted gracefuly"

$pm2 kill
