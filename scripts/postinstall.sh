#!/bin/bash

`command -v node || command -v nodejs` ./scripts/ping.js
if [ $? -eq 0 ]
then
    bash ./scripts/kill.js
    if [ $? -eq 0 ]
    then
        ./bin/pm2 resurrect
    fi
fi

# This makes sure that the .pm2 directory is created (eg invoke CLI)
./bin/pm2 -v

exit 0;
