#!/bin/bash

#
# Check if user is logged as root and that pm2 command is available
#

if ( [ "$EUID" -eq 0 ] || [ "$USER" == "root" ] ) && ! command -v pm2 2>&1;
  then
    echo "##### PM2 INSTALLATION"
    echo "#"
    echo "#"
    echo "# As you run PM2 as root, to update PM2 automatically"
    echo "# you must add the --unsafe-perm flag."
    echo "#"
    echo "#       $  npm install pm2 -g --unsafe-perm"
    echo "#"
    echo "# Else run the installation as a non root user"
    echo "#"
    echo "#"
    echo "#"
    echo "######"
    echo ""
  exit 1
fi

which pm2


`command -v node || command -v nodejs` ./scripts/ping.js
if [ $? -eq 0 ]
then
    echo "Saving process list..."
    pm2 dump
    echo "Done."
    exit 0;
else
    exit 0;
fi
