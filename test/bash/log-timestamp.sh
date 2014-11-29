#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

function head {
  echo -e "\x1B[1;35m$1\x1B[0m"
}
function no_prefix {
  sleep 0.3
  OUT=`cat $pm2_log | grep -n "[0-9]\{4\}\-[0-9]\{2\}\-[0-9]\{2\}" | wc -l`
  [ $OUT -eq 0 ] || fail "expect no timestamp prefix in pm2.log, but currently existing."
  success "have no timestamp prefix"
  if [ "$1" -ne 1 ]; then
    $pm2 kill
    rm -rf $pm2_log
  fi
}
function prefix {
  sleep 0.3
  OUT=`cat $pm2_log | grep -n "[0-9]\{4\}\-[0-9]\{2\}\-[0-9]\{2\}" | wc -l`
  [ $OUT -ne 0 ] || fail "expect have timestamp prefix in pm2.log, but currently does not exist."
  success "have timestamp prefix"
  if [ "$1" -ne 1 ]; then
    $pm2 kill
    rm -rf $pm2_log
  fi
}

cd $file_path

if [ -z $PM2_HOME ]; then
  if [ -z $HOME ];then
    if [ -z $HOMEPATH ]; then
      fail "can not locate pm2 home"
    else
      pm2_log="$HOMEPATH/.pm2"
    fi
  else
    pm2_log="$HOME/.pm2"
  fi
else
  pm2_log="$PM2_HOME"
fi

pm2_log="$pm2_log/pm2.log"

echo "root: $pm2_log";

$pm2 kill

rm -rf $pm2_log

unset PM2_LOG_DATE_FORMAT

head ">> LIST (NO PREFIX)"
$pm2 ls
no_prefix 0

head ">> START (NO PREFIX)"
$pm2 start echo.js
no_prefix 1

head ">> RESTART (NO PREFIX)"
$pm2 restart echo
no_prefix 1

head ">> STOP (NO PREFIX)"
$pm2 stop echo
no_prefix 0

head ">> START JSON (NO PREFIX)"
$pm2 start echo-pm2.json
no_prefix 1

head ">> RESTART JSON (NO PREFIX)"
$pm2 restart echo-pm2.json
no_prefix 1

head ">> STOP-JSON (NO PREFIX)"
$pm2 stop echo-pm2.json
no_prefix 0

export PM2_LOG_DATE_FORMAT="YYYY-MM-DD HH:mm Z"

head ">> LIST (PREFIX)"
$pm2 ls
prefix 0

head ">> START (PREFIX)"
$pm2 start echo.js
prefix 1

head ">> RESTART (PREFIX)"
$pm2 restart echo
prefix 1

head ">> STOP (PREFIX)"
$pm2 stop echo
prefix 0

head ">> START JSON (PREFIX)"
$pm2 start echo-pm2.json
prefix 1

head ">> RESTART JSON (PREFIX)"
$pm2 restart echo-pm2.json
prefix 1

head ">> STOP-JSON (PREFIX)"
$pm2 restart echo-pm2.json
prefix 0

unset PM2_LOG_DATE_FORMAT
