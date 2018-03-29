
#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path/log-json/

rm output.log

# fork mode json logs
$pm2 start ecosystem.json --only one-echo

! test -f output.log

sleep 2

node -pe 'JSON.parse(process.argv[1])' `cat output.log`
spec 'should have parsed valid json'

$pm2 delete all
rm output.log

# cluster mode json logs
$pm2 start ecosystem.json -i 2 --only one-echo-cluster

! test -f output.log

sleep 2

node -pe 'JSON.parse(process.argv[1])' `cat output.log`
spec 'should have parsed valid json'

$pm2 delete all
rm output.log

CURRENT_YEAR=`date +"%Y"`
# fork mode with date

$pm2 start ecosystem.json --only one-echo-date

! test -f output.log

sleep 2

node -pe 'JSON.parse(process.argv[1])' `cat output.log`
spec 'should have parsed valid json'

OUT=`cat output.log | grep -o "$CURRENT_YEAR" | wc -l`
[ $OUT -eq 1 ] || fail "should contains custom timestamp"
success "should contains custom timestamp"

$pm2 delete all
rm output.log

# cluster mode with date

$pm2 start ecosystem.json --only one-echo-cluster-date

! test -f output.log

sleep 2

node -pe 'JSON.parse(process.argv[1])' `cat output.log`
spec 'should have parsed valid json'

OUT=`cat output.log | grep -o "$CURRENT_YEAR" | wc -l`
[ $OUT -eq 1 ] || fail "should contains custom timestamp in cluster mode"
success "should contains custom timestamp in cluster mode"

$pm2 delete all
rm output.log
