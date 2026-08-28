#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path

# Every line L0000..L0199 must be present exactly once in out and err,
# whatever the mode / date prefixing (#6125)
check_integrity() {
  for f in big-out.log big-err.log; do
    COUNT=$(grep -c '^\(.*: \)\?L[0-9]\{4\} x' $f)
    [ "$COUNT" -eq 200 ]
    spec "$1: $f should contain 200 intact lines (got $COUNT)"
    LAST=$(grep -c 'L0199 x*$' $f)
    [ "$LAST" -eq 1 ]
    spec "$1: $f last line should be intact"
  done
}

run_case() {
  rm -f big-out.log big-err.log
  $pm2 start big-log-burst.js -o big-out.log -e big-err.log --merge-logs $2
  sleep 2
  check_integrity "$1"
  $pm2 delete all
}

run_case "fork plain" ""
run_case "fork --time" "--time"
run_case "cluster plain" "-i 1"
run_case "cluster --time" "-i 1 --time"

# with --time, every line must be prefixed
rm -f big-out.log big-err.log
$pm2 start big-log-burst.js -o big-out.log -e big-err.log --merge-logs --time
sleep 2
COUNT=$(grep -c '^[0-9T:\.\-]*: L[0-9]\{4\} x' big-out.log)
[ "$COUNT" -eq 200 ]
rm -f big-out.log big-err.log
spec "fork --time: every line should be date-prefixed (got $COUNT)"
$pm2 delete all

rm -f big-out.log big-err.log
$pm2 start big-log-burst.js -o big-out.log -e big-err.log --merge-logs -i 1 --time
sleep 2
COUNT=$(grep -c '^[0-9T:\.\-]*: L[0-9]\{4\} x' big-out.log)
[ "$COUNT" -eq 200 ]
rm -f big-out.log big-err.log
spec "cluster --time: every line should be date-prefixed (got $COUNT)"
$pm2 delete all

rm -f big-out.log big-err.log
