#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

cd $file_path

echo -e "\033[1mRunning tests:\033[0m"


$pm2 kill

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

$pm2 kill

$pm2 start env.json

cat /dev/null > $OUT_LOG

sleep 1

OUT=`cat $OUT_LOG | head -n 1`

if [ $OUT = "undefined" ]
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
