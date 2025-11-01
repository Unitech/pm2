#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path/stdin

$pm2 start stdin.js -o out-rel.log --merge-logs
>out-rel.log

# Send LINE\n to stdin application
$pm2 send 0 "LINE"

# Wait for log to be written with circuit breaker
max_attempts=5
attempt=0
while [ $attempt -lt $max_attempts ]; do
  if grep -q "LINE" out-rel.log 2>/dev/null; then
    break
  fi
  sleep 0.1
  attempt=$((attempt + 1))
done

cat out-rel.log
grep "LINE" out-rel.log
spec "Should have reveived line"

$pm2 delete all
