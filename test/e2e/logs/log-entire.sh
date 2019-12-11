
#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

function head {
  echo -e "\x1B[1;35m$1\x1B[0m"
}
function test_dir {
  local result=""
  if [ -f "$1-0.log" ]; then
    result="$1-0.log"
  else
    result="$1.log"
  fi
  echo "$result"
}
function test {
  sleep 5

  out_file=$(test_dir "out")
  err_file=$(test_dir "err")
  if [ ! -n "$1" ]; then
    entire_file=$(test_dir "entire")
  fi

  COUNT=$(grep "tick" $out_file | wc -l)
  echo "$COUNT"
  [ "$COUNT" -ne 0 ] || fail "Should have \"tick\" in out log."
  success "Should have \"tick\" in out log."

  COUNT=$(grep "Error" $err_file | wc -l)
  echo "$COUNT"
  [ "$COUNT" -ne 0 ] || fail "Should have \"Error\" in error log."
  success "Should have \"Error\" in error log."

  if [ ! -n "$1" ]; then
    COUNT1=$(grep "tick" $entire_file | wc -l)
    echo "$COUNT1"
    COUNT2=$(grep "Error" $entire_file | wc -l)
    echo "$COUN2"

    ([ "$COUNT1" -ne 0 ] && [ "$COUNT2" -ne 0 ]) || fail "Should have \"tick\" and \"Error\" in entire log."
    success "Should have \"tick\" and \"Error\" in entire log."
  fi
  $pm2 kill

  sleep 1

  rm $out_file
  rm $err_file

  if [ ! -n "$1" ]; then
    rm $entire_file
  fi
}

cd $file_path

$pm2 kill

head ">> START CLUSTERMODE (ENTIRE EXISTS)"

$pm2 start throw-later.js -i 1 -o out.log -e err.log -l entire.log

test

head ">> START CLUSTERMODE (ENTIRE DOES NOT EXIST)"

$pm2 start throw-later.js -i 1 -o out.log -e err.log

test "NE"

head ">> START CLUSTERMODE WITH --merge-logs (ENTIRE EXISTS)"

$pm2 start throw-later.js -i 1 -o out.log -e err.log -l entire.log --merge-logs

test

head ">> START CLUSTERMODE WITH --merge-logs (ENTIRE DOES NOT EXIST)"

$pm2 start throw-later.js -i 1 -o out.log -e err.log --merge-logs

test "NE"


head ">> START FORKMODE (ENTIRE EXISTS)"

$pm2 start throw-later.js -o out.log -e err.log -l entire.log

test

head ">> START FORKMODE (ENTIRE DOES NOT EXIST)"

$pm2 start throw-later.js -o out.log -e err.log

test "NE"

head ">> START FORKMODE WITH --merge-logs (ENTIRE EXISTS)"

$pm2 start throw-later.js -o out.log -e err.log -l entire.log --merge-logs

test

head ">> START FORKMODE WITH --merge-logs (ENTIRE DOES NOT EXIST)"

$pm2 start throw-later.js -o out.log -e err.log --merge-logs

test "NE"

head ">> RELOAD LOGS (ENTIRE EXISTS)"

$pm2 start throw-later.js -o out.log -e err.log -l entire.log --merge-logs

$pm2 reloadLogs

test

head ">> RELOAD LOGS (ENTIRE DOES NOT EXIST)"

$pm2 start throw-later.js -o out.log -e err.log --merge-logs

$pm2 reloadLogs

test "NE"

head ">> RESTART (ENTIRE EXISTS)"

$pm2 start throw-later.js -o out.log -e err.log -l entire.log --merge-logs

$pm2 restart all

test

head ">> RESTART (ENTIRE DOES NOT EXIST)"

$pm2 start throw-later.js -o out.log -e err.log --merge-logs

$pm2 restart all

test "NE"

head ">> RELOAD (ENTIRE EXISTS)"

$pm2 start throw-later.js -o out.log -e err.log -l entire.log --merge-logs

$pm2 reload all

test

head ">> RELOAD (ENTIRE DOES NOT EXIST)"

$pm2 start throw-later.js -o out.log -e err.log --merge-logs

$pm2 reload all

test "NE"

head ">> DESCRIBE (ENTIRE EXISTS)"

$pm2 start throw-later.js -o out.log -e err.log -l entire.log --merge-logs

$pm2 jlist | grep -w "entire.log" 2> /dev/null
spec "\"entire log path\" should exists."

test

head ">> DESCRIBE (ENTIRE DOES NOT EXIST)"

$pm2 start throw-later.js -o out.log -e err.log --merge-logs

$pm2 jlist | grep -w "pm_log_path" 2> /dev/null
ispec "\"entire log path\" should not exist."

test "NE"

head ">> FLUSH (ENTIRE EXISTS)"

$pm2 start throw-later.js -o out.log -e err.log -l entire.log --merge-logs

$pm2 flush

test

head ">> FLUSH (ENTIRE DOES NOT EXIST)"

$pm2 start throw-later.js -o out.log -e err.log --merge-logs

$pm2 flush

test "NE"

head ">> JLIST (ENTIRE EXISTS)"

$pm2 start throw-later.js -o out.log -e err.log -l entire.log --merge-logs

$pm2 jlist | grep -w "pm_log_path"
spec "\"entire log path\" should exists."

test

head ">> JLIST (ENTIRE DOES NOT EXIST)"

$pm2 start throw-later.js -o out.log -e err.log --merge-logs

$pm2 jlist | grep -w "pm_log_path"
ispec "\"entire log path\" should not exist."

test "NE"

head ">> START JSON (ENTIRE EXISTS)"

$pm2 start throw-later.json

test

head ">> START JSON (ENTIRE DOES NOT EXIST)"

$pm2 start throw-later1.json

test "NE"

$pm2 kill
