#!/bin/bash

if [ "$EUID" -eq 0 ]
  then
    echo "As you run PM2 as root, to update PM2 automatically you must add the --unsafe-perm flag else run the installation as non root user"
  exit
fi

`command -v node || command -v nodejs` ./scripts/ping.js
if [ $? -eq 0 ]
then
    bash ./scripts/kill.js
    ./bin/pm2 resurrect
    exit 0;
else
    exit 0;
fi
