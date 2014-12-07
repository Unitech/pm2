#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

function head {
  echo -e "\x1B[1;35m$1\x1B[0m"
}

function test {
  if [ "$1" -gt 0 ]; then
    success "$2"
  else
    fail "$2"
  fi
}

cd $file_path

$pm2 kill

sleep 0.5

head "config literal substitution (pro env)"

$pm2 start literal-subs.json --env pro

OUT=`$pm2 jlist 0`

head ">> name"
TEST_CASE="Substitution-\${ MODE | substr(5, 3) | capitalize } should be substituded by Substitution-Pro"
COUNT=`echo "$OUT" | grep '"name":"Substitution-Pro"' | wc -l`
test $COUNT "$TEST_CASE"

head ">> script"
TEST_CASE="literal-\${ MODE | lower }.js should be substituded by literal-subs-pro.js"
COUNT=`echo "$OUT" | egrep '"pm_exec_path":"[^\"]+pro.js"' | wc -l`
test $COUNT "$TEST_CASE"

head ">> args"
TEST_CASE="\"args\":[\"\${ MODE | upper }\"] should be substituded by \"args\":[\"SUBS-PRO\"]"
COUNT=`echo "$OUT" | grep '"args":\["SUBS-PRO"\]' | wc -l`
test $COUNT "$TEST_CASE"

head ">> log_file"
TEST_CASE="\"log_file\":\"\${ MODE | lower }.log\" should be substituded by \"log_file\":\"pro.log\""
COUNT=`echo "$OUT" | egrep '"pm_log_path":"[^\"]+pro.log"' | wc -l`
test $COUNT "$TEST_CASE"

head ">> error_file"
TEST_CASE="\"error_file\":\"\${ MODE | lower }-err.log\" should be substituded by \"error_file\":\"pro-err.log\""
COUNT=`echo "$OUT" | egrep '"pm_err_log_path":"[^\"]+pro-err.log"' | wc -l`
test $COUNT "$TEST_CASE"

head ">> out_file"
TEST_CASE="\"out_file\":\"\${ MODE | lower }-out.log\" should be substituded by \"out_file\":\"pro-out.log\""
COUNT=`echo "$OUT" | egrep '"pm_out_log_path":"[^\"]+pro-out.log"' | wc -l`
test $COUNT "$TEST_CASE"

head ">> pid_file"
TEST_CASE="\"pid_file\":\"\${ MODE | lower | replace('-\\\\w+$', '') }.pid\" should be substituded by \"pid_file\":\"subs.pid\""
COUNT=`echo "$OUT" | egrep '"pm_pid_path":"[^\"]+subs-0.pid"' | wc -l`
test $COUNT "$TEST_CASE"

head ">> log_date_format"
TEST_CASE="\"log_date_format\":\"\${ LOG_PREFIX | def('YYYY-MM-DD HH:mm') }\" should be substituded by \"log_date_format\":\"YYYY-MM-DD HH:mm:ss Z\""
COUNT=`echo "$OUT" | grep '"log_date_format":"YYYY-MM-DD HH:mm:ss Z"' | wc -l`
test $COUNT "$TEST_CASE"

$pm2 kill

sleep 0.5

head "config literal substitution (dev env)"

$pm2 start literal-subs.json --env dev

OUT=`$pm2 jlist 0`

head ">> name"
TEST_CASE="Substitution-\${ MODE | substr(5, 3) | capitalize } should be substituded by Substitution-Dev"
COUNT=`echo "$OUT" | grep '"name":"Substitution-Dev"' | wc -l`
test $COUNT "$TEST_CASE"

head ">> script"
TEST_CASE="literal-\${ MODE | lower }.js should be substituded by literal-subs-dev.js"
COUNT=`echo "$OUT" | egrep '"pm_exec_path":"[^\"]+dev.js"' | wc -l`
test $COUNT "$TEST_CASE"

head ">> args"
TEST_CASE="\"args\":[\"\${ MODE | upper }\"] should be substituded by \"args\":[\"SUBS-DEV\"]"
COUNT=`echo "$OUT" | grep '"args":\["SUBS-DEV"\]' | wc -l`
test $COUNT "$TEST_CASE"

head ">> log_file"
TEST_CASE="\"log_file\":\"\${ MODE | lower }.log\" should be substituded by \"log_file\":\"dev.log\""
COUNT=`echo "$OUT" | egrep '"pm_log_path":"[^\"]+dev.log"' | wc -l`
test $COUNT "$TEST_CASE"

head ">> error_file"
TEST_CASE="\"error_file\":\"\${ MODE | lower }-err.log\" should be substituded by \"error_file\":\"dev-err.log\""
COUNT=`echo "$OUT" | egrep '"pm_err_log_path":"[^\"]+dev-err.log"' | wc -l`
test $COUNT "$TEST_CASE"

head ">> out_file"
TEST_CASE="\"out_file\":\"\${ MODE | lower }-out.log\" should be substituded by \"out_file\":\"dev-out.log\""
COUNT=`echo "$OUT" | egrep '"pm_out_log_path":"[^\"]+dev-out.log"' | wc -l`
test $COUNT "$TEST_CASE"

head ">> pid_file"
TEST_CASE="\"pid_file\":\"\${ MODE | lower | replace('-\\\\w+$', '') }.pid\" should be substituded by \"pid_file\":\"subs.pid\""
COUNT=`echo "$OUT" | egrep '"pm_pid_path":"[^\"]+subs-0.pid"' | wc -l`
test $COUNT "$TEST_CASE"

head ">> log_date_format"
TEST_CASE="\"log_date_format\":\"\${ LOG_PREFIX | def('YYYY-MM-DD HH:mm') }\" should be substituded by \"log_date_format\":\"YYYY-MM-DD HH:mm\""
COUNT=`echo "$OUT" | grep '"log_date_format":"YYYY-MM-DD HH:mm"' | wc -l`
test $COUNT "$TEST_CASE"

$pm2 kill
