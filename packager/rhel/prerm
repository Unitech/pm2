#!/bin/bash

if hash systemctl 2> /dev/null; then
    systemctl disable "pm2.service" && \
        systemctl stop "pm2.service" || \
        echo "pm2 wasn't even running!"
elif hash service 2> /dev/null; then
    service "pm2" stop || echo "pm2 wasn't even running!"
else
    echo "Your system does not appear to use upstart, systemd or sysv, so pm2 could not be stopped"
    echo 'Unless these systems were removed since install, no processes have been left running'
fi
