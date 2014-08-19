#!/bin/bash

bash ./scripts/ping.js
if [ $? -eq 0 ]
then
    echo "Saving process list..."
    pm2 dump
    echo "Done."
    exit 0;
else
    exit 0;
fi
