#!/bin/bash

set -e

mkdir -p /etc/pm2

adduser --system \
        --home-dir /etc/pm2 \
        --comment "PM2 Process Manager" pm2

chown -R pm2:pm2 /etc/pm2

if hash systemctl 2> /dev/null; then
    {
        systemctl enable "pm2.service" && \
            systemctl start "pm2.service"
    } || echo "pm2 could not be registered or started"
elif hash service 2> /dev/null; then
    service "pm2" start || echo "pm2 could not be registered or started"
else
    echo 'Ingnoring pm2 auto-startup.'
    echo 'You can run `pm2 startup` as root to do it manually.'
fi
