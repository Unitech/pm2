#!/bin/bash

VERSION=`node dist/bin/pm2 --version`
CMD_SEND="artifacts/pm2_${VERSION}_all.deb marketing@ssh.km:~/packages"
CMD_PUB="cd /var/www/apt/ubuntu; reprepro includedeb xenial ~/packages/pm2_${VERSION}_all.deb"

echo $CMD_PUB
scp $CMD_SEND
ssh marketing@ssh.km -C $CMD_PUB
