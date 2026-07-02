#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path/interpreter

# Without bun, .ts falls back to node type stripping which requires
# node >= 22.6; skip on older nodes where no .ts interpreter is available
if [ "$IS_BUN" = false ] && ! command -v bun > /dev/null 2>&1; then
  TS_SUPPORT=$(node -p "require('${SRC}/../../../lib/tools/typestrip.js').supportLevel(process.versions.node) !== false")
  if [ "$TS_SUPPORT" != "true" ]; then
    echo "Skipping TypeScript test: node $(node -v) has no type stripping and bun is not installed"
    exit 0
  fi
fi

########### typescript fork test

$pm2 delete all

>typescript-native.log

$pm2 start echo-strippable.ts -o typescript-native.log --merge-logs

sleep 1.5

grep "Hello Typescript!" typescript-native.log
spec "Should run TypeScript file in fork mode"

should 'should have process online' 'online' 1

if [ "$IS_BUN" = false ] && ! command -v bun > /dev/null 2>&1; then
  should 'should run TypeScript with node interpreter' "exec_interpreter: 'node'" 1
fi

########### typescript cluster test

$pm2 delete all

>typescript-native.log

$pm2 start echo-strippable.ts -i 2 -o typescript-native.log --merge-logs

sleep 2

should 'should have 2 processes online' 'online' 2

grep "Hello Typescript!" typescript-native.log
spec "Should run TypeScript file in cluster mode"

$pm2 delete all
