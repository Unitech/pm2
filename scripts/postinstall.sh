#!/bin/bash

`command -v node || command -v nodejs` ./scripts/ping.js
if [ $? -eq 0 ]
then
    bash ./scripts/kill.js
    if [ $? -eq 0 ]
    then
        ./bin/pm2 resurrect
    fi
    exit 0;
else
    exit 0;
fi
