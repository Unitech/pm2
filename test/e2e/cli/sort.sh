#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path/sort

$pm2 start http.js
$pm2 start other.js


$pm2 list --sort=name > /tmp/tmp_out.txt

OUT=`cat /tmp/tmp_out.txt | grep -v "npm" | grep -no "http" -m 1 | cut -f1 -d:`
OUT2=`cat /tmp/tmp_out.txt | grep -v "npm" | grep -no "other" -m 1 | cut -f1 -d:`

[ $OUT -lt $OUT2 ] || fail "should sort app by name (asc)"
success "should sort app by name (asc)"

$pm2 list --sort=name:desc > /tmp/tmp_out.txt

OUT=`cat /tmp/tmp_out.txt | grep -v "npm" | grep -no "http" -m 1 | cut -f1 -d:`
OUT2=`cat /tmp/tmp_out.txt | grep -v "npm" | grep -no "other" -m 1 | cut -f1 -d:`

[ $OUT -gt $OUT2 ] || fail "should sort app by name (desc)"
success "should sort app by name (desc)"


$pm2 list --sort=id > /tmp/tmp_out.txt

OUT=`cat /tmp/tmp_out.txt | grep -v "npm" | grep -no "http" -m 1 | cut -f1 -d:`
OUT2=`cat /tmp/tmp_out.txt | grep -v "npm" | grep -no "other" -m 1 | cut -f1 -d:`

[ $OUT -lt $OUT2 ] || fail "should sort app by id (asc)"
success "should sort app by id (asc)"

$pm2 list --sort=id:desc > /tmp/tmp_out.txt

OUT=`cat /tmp/tmp_out.txt | grep -v "npm" | grep -no "http" -m 1 | cut -f1 -d:`
OUT2=`cat /tmp/tmp_out.txt | grep -v "npm" | grep -no "other" -m 1 | cut -f1 -d:`

[ $OUT -gt $OUT2 ] || fail "should sort app by id (desc)"
success "should sort app by id (desc)"
