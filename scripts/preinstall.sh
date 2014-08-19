#!/bin/bash

#
# Check if user is logged as root and that pm2 command is available
#

if ( [ "$EUID" -eq 0 ] || [ "$USER" == "root" ] ) && ! ( env | grep "unsafe-perm" );
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
