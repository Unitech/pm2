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

###################
# Testing symlink #
###################

$pm2 kill

#set init state
ln -sfn symlink/20140101/server.js ./symlink-server.js

$pm2 start symlink-server.js -o ./symlink-out.log

should 'app should be online' 'online' 1

mkdir symlink/20140202
cp server-echo.js symlink/20140202/server.js

ln -sfn symlink/20140202/server.js ./symlink-server.js

$pm2 restart all

OUT=`cat ./symlink-out-0.log | grep -o "Server is listenning on port 8020" | wc -l`

[ $OUT -eq 1 ] || fail "Should start updated symlink"
success "Should start updated symlink"

#removing tests fixtures
rm -R symlink/20140202
rm ./symlink-out-0.log