#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/bash/include.sh"

echo "####################### DEBUG ############################"
echo "PM2 Command = " $pm2
echo "Node version = " $nodeVersion
$node -e "var os = require('os'); console.log('arch : %s\nplatform : %s\nrelease : %s\ntype : %s\nmem : %d', os.arch(), os.platform(), os.release(), os.type(), os.totalmem())"
echo "###################### !DEBUG! ###########################"


bash ./test/bash/cli.sh
bash ./test/bash/json_file.sh
bash ./test/bash/harmony.sh
bash ./test/bash/reload.sh
bash ./test/bash/right-exit-code.sh
bash ./test/bash/log-reload.sh
bash ./test/bash/gracefulReload.sh
bash ./test/bash/gracefulReload2.sh
bash ./test/bash/gracefulReload3.sh
bash ./test/bash/cli2.sh
bash ./test/bash/misc.sh
bash ./test/bash/fork.sh
bash ./test/bash/infinite_loop.sh

$pm2 kill