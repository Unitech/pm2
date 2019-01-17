#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

function head {
  echo -e "\x1B[1;35m$1\x1B[0m"
}
function rm_pm2log {
  if [ "$1" -ne 1 ]; then
    $pm2 kill
    rm -rf ~/.pm2/pm2.log
  fi
}
function grep_log {

    echo "travis"
    eval "$pm2 $1 >| pm2.log"
    sleep 0.3
    OUT=`cat pm2.log | grep -n "[0-9]\{4\}\-[0-9]\{2\}\-[0-9]\{2\}" | wc -l`
}
function no_prefix {
  eval "grep_log \"$1\""
  echo "line count: $OUT"
  [ $OUT -eq 0 ] || fail "expect no timestamp prefix in pm2.log, but currently existing."
  success "have no timestamp prefix"
  rm_pm2log "$2"
}
function prefix {
  eval "grep_log \"$1\""
  echo "line count: $OUT"
  [ $OUT -ne 0 ] || fail "expect have timestamp prefix in pm2.log, but currently does not exist."
  success "have timestamp prefix"

  rm_pm2log "$2"
}

cd $file_path

$pm2 kill

sleep 0.5

$pm2 flush

unset PM2_LOG_DATE_FORMAT
export PM2_LOG_DATE_FORMAT=""

head ">> LIST (NO PREFIX)"
no_prefix "ls" 0

head ">> START (NO PREFIX)"
no_prefix "start echo.js" 1

head ">> RESTART (NO PREFIX)"
no_prefix "restart echo" 1

head ">> STOP (NO PREFIX)"
no_prefix "stop echo" 0

head ">> START JSON (NO PREFIX)"
no_prefix "start echo-pm2.json" 1

head ">> RESTART JSON (NO PREFIX)"
no_prefix "restart echo-pm2.json" 1

head ">> STOP-JSON (NO PREFIX)"
no_prefix "stop echo-pm2.json" 0

export PM2_LOG_DATE_FORMAT="YYYY-MM-DD HH:mm Z"

head ">> LIST (PREFIX)"
prefix "ls" 0

head ">> START (PREFIX)"
prefix "start echo.js" 1

head ">> RESTART (PREFIX)"
prefix "restart echo" 1

head ">> STOP (PREFIX)"
prefix "stop echo" 0

head ">> START JSON (PREFIX)"
prefix "start echo-pm2.json" 1

head ">> RESTART JSON (PREFIX)"
prefix "restart echo-pm2.json" 1

head ">> STOP-JSON (PREFIX)"
prefix "restart echo-pm2.json" 0

rm -rf pm2.log
unset PM2_LOG_DATE_FORMAT
touch ~/.pm2/pm2.log
