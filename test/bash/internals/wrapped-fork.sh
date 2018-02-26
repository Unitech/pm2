#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path

echo "################## Wrapped fork ###################"

echo "Testing wrapped fork mode values"

rm path-check1.txt
rm path-check2.txt

node path-check.js > path-check1.txt
$pm2 start path-check.js --no-autorestart -o path-check2.txt
sleep 1

OUT=`diff path-check1.txt path-check2.txt`

echo $OUT
[ -z "$OUT" ] || fail "The outputs are not identical"
success "The outputs are identical"

$pm2 kill
