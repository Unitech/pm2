#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path/args

rm args.log
> args.log

## Test #1

$pm2 start -f params_check.js --merge-logs -o args.log --name 'some-project' -- \
     --logger.level=info \
     --koa.hostname=0.0.0.0 \
     --ms.amqp.hostname=amqps://localhost \
     --ms.amqp.port=5673 \
     --ms.amqp.heartbeat=30 \
     --ms.amqp.username=someuser \
     --ms.amqp.password=12345 \
     --ms.amqp.vhost=default \
     --mailer.config.host=localhost \
     --mailer.config.auth=null

function hasArg {
    if [ "$2" ]
    then
        OCCURENCES=$2
    else
        OCCURENCES=1
    fi
    CMD=`grep -c -- $1 args.log`
    [ $CMD -eq $OCCURENCES ] || fail "Arg $1 not present"
    success "Arg $1 present"
}

sleep 2
hasArg "--logger.level=info"
hasArg "--koa.hostname=0.0.0.0"
hasArg "--ms.amqp.hostname=amqps://localhost"
hasArg "--ms.amqp.port=5673"
hasArg "--ms.amqp.heartbeat=30"
hasArg "--ms.amqp.username=someuser"
hasArg "--ms.amqp.password=12345"
hasArg "--ms.amqp.vhost=default"
hasArg "--mailer.config.host=localhost"
hasArg "--mailer.config.auth=null"

## Test #2 with double params

$pm2 delete all
>args.log

$pm2 start -f params_check.js echo.js --merge-logs -o args.log -- argv1 argv1 argv2 argv3

sleep 2
hasArg "argv1" 2
hasArg "argv2"
hasArg "argv3"
