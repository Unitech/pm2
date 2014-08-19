#!/bin/bash

`command -v node || command -v nodejs` ./scripts/ping.js
if [ $? -eq 0 ]
then
    bash ./scripts/kill.js
    ./bin/pm2 resurrect
    exit 0;
else
    exit 0;
fi
