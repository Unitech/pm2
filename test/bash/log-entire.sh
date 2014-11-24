
#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/include.sh"

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
  out_file=$(test_dir "out")
  err_file=$(test_dir "err")
  entire_file=$(test_dir "entire")

  grep "tick" $out_file
  spec "Should have \"tick\" in out log."

  grep "Error" $err_file
  spec "Should have \"Error\" in err log."

  grep "tick" $entire_file
  spec "Should have \"tick\","

  grep "Error" $entire_file
  spec "and \"Error\" in entire log."

  $pm2 delete all

  sleep 1

  rm $out_file
  rm $err_file
  rm $entire_file
}

cd $file_path

$pm2 kill

head ">> START CLUSTERMODE"

$pm2 start throw-later.js -i 1 -o out.log -e err.log -l entire.log

sleep 1

test

head ">> START CLUSTERMODE WITH BEING MERGED"

$pm2 start throw-later.js -i 1 -o out.log -e err.log -l entire.log --merge-logs

sleep 1

test

head ">> RELOAD LOGS"

$pm2 start throw-later.js -o out.log -e err.log -l entire.log --merge-logs

$pm2 reloadLogs

sleep 1

test

head ">> RESTART"

$pm2 start throw-later.js -o out.log -e err.log -l entire.log --merge-logs

$pm2 restart all

sleep 1

test

head ">> RELOAD"

$pm2 start throw-later.js -o out.log -e err.log -l entire.log --merge-logs

$pm2 reload all

sleep 1

test

head ">> DESCRIBE"

$pm2 start throw-later.js -o out.log -e err.log -l entire.log --merge-logs

$pm2 desc "throw-later" | grep -w "entire log path"
spec "\"entire log path\" should exists."

sleep 1

test

head ">> FLUSH"

$pm2 start throw-later.js -o out.log -e err.log -l entire.log --merge-logs

$pm2 flush

sleep 1

test

head ">> JLIST"

$pm2 start throw-later.js -o out.log -e err.log -l entire.log --merge-logs

$pm2 jlist | grep -w "pm_log_path" | wc -l
spec "\"entire log path\" should exists."

sleep 1

test

head ">> START JSON"

$pm2 start throw-later.json

sleep 1

test

$pm2 kill
