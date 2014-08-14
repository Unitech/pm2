#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

cd $file_path

echo -e "\033[1mRunning tests:\033[0m"

#
# Max memory auto restart option
#
# -max-memory-restart option && maxMemoryRestart (via JSON file)
#
$pm2 start big-array.js --max-memory-restart 19
sleep 7
$pm2 list
should 'process should been restarted' 'restart_time: 0' 0

$pm2 delete all

#
# Via JSON
#
$pm2 start max-mem.json
sleep 7
$pm2 list
should 'process should been restarted' 'restart_time: 0' 0

$pm2 delete all

$pm2 start env.js

OUT_LOG=`$pm2 prettylist | grep -m 1 -E "pm_out_log_path:" | sed "s/.*'\([^']*\)',/\1/"`

cat /dev/null > $OUT_LOG

sleep 1

OUT=`cat $OUT_LOG | head -n 1`

if [ $OUT = "undefined" ]
then
    success "environment variable not defined"
else
    fail "environment defined ? wtf ?"
fi

$pm2 delete all

$pm2 start env.json

cat /dev/null > $OUT_LOG

sleep 1

OUT=`cat $OUT_LOG | head -n 1`

if [ "$OUT" = "undefined" ]
then
    fail "environment variable hasnt been defined"
else
    success "environment variable successfully defined"
fi


#####################
# Merge logs option #
#####################
$pm2 kill

rm outmerge*

$pm2 start echo.js -i 4 -o outmerge.log

cat outmerge.log > /dev/null
ispec 'file outmerge.log should not exist'

cat outmerge-0.log > /dev/null
spec 'file outmerge-0.log should exist'

rm outmerge*

############ Now with --merge option

$pm2 kill

rm outmerge*

$pm2 start echo.js -i 4 -o outmerge.log --merge-logs

cat outmerge.log > /dev/null
spec 'file outmerge.log should exist'

cat outmerge-0.log > /dev/null
ispec 'file outmerge-0.log should not exist'

rm outmerge*

########### coffee cluster test
$pm2 delete all

$pm2 start echo.coffee

should 'process should not have been restarted' 'restart_time: 0' 1
should 'process should be online' "status: 'online'" 1
