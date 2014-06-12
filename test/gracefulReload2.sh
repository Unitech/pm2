#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

cd $file_path

echo "################## GRACEFUL RELOAD 2 ###################"

###############
$pm2 kill

echo "Launching"
$pm2 start graceful-exit-no-listen.js -i 2 --name="graceful2" -o "grace2.log" -e "grace-err2.log"
should 'should start processes' 'online' 2

OUT_LOG=`$pm2 prettylist | grep -m 1 -E "pm_out_log_path:" | sed "s/.*'\([^']*\)',/\1/"`
cat /dev/null > $OUT_LOG

#### Graceful reload name
$pm2 gracefulReload graceful2

OUT=`grep "Finished closing connections" "$OUT_LOG" | wc -l`
[ $OUT -eq 1 ] || fail "Non-listening process not restarted gracefuly"
success "Non-listening process restarted gracefuly"

$pm2 kill
