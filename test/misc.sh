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

$pm2 start echo.js -i max -o outmerge.log

cat outmerge.log > /dev/null
ispec 'file outmerge.log should not exist'

cat outmerge-0.log > /dev/null
spec 'file outmerge-0.log should exist'

rm outmerge*

############ Now with --merge option

$pm2 kill

rm outmerge*

$pm2 start echo.js -i max -o outmerge.log --merge-logs

cat outmerge.log > /dev/null
spec 'file outmerge.log should exist'

cat outmerge-0.log > /dev/null
ispec 'file outmerge-0.log should not exist'

rm outmerge*

#####################
# Watch for changes #
#####################
$pm2 kill

cp server-watch.bak.js server-watch.js

$pm2 --watch start server-watch.js

sleep 1

echo "setTimeout(function() { console.log('still ok') })" >> server-watch.js

for (( i = 0; i <= 50; i++ )); do
    sleep 0.2
    echo -n "."
done

$pm2 list

should 'process should have been restarted' 'restart_time: 1' 1

rm server-watch.js


###############
$pm2 kill

#
# Dont work on travis
#

# Script should fail but be started again on next change
# cp server-watch.bak.js server-watch.js

# $pm2 start --watch server-watch.js

# echo "setTimeout(function() { process.exit(0) }, 1)" > server-watch.js

# for (( i = 0; i <= 50; i++ )); do
#     sleep 0.2
#     echo -n "."
# done

# $pm2 list
# should 'should have stopped unstable process' 'errored' 1

# cp server-watch.bak.js server-watch.js

# for (( i = 0; i <= 50; i++ )); do
#     sleep 0.2
#     echo -n "."
# done

# $pm2 list
# should 'should start the errored process again while putting file back' 'online' 1

# rm server-watch.js


# $pm2 kill
