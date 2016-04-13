#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/bash/include.sh"

# Abort script at first error
set -e
# Display all commands executed
set -o verbose

# if [ $TRAVIS ]
# then
#   export DEBUG="*"
# fi

bash ./test/bash/cli-actions-1.sh
spec "CLI basic test"
bash ./test/bash/cli-actions-2.sh
spec "Second hard cli tests"

bash ./test/bash/log-timestamp.sh
spec "timestamp prefix of pm2.log"
bash ./test/bash/smart-start.sh
spec "smart start test"
bash ./test/bash/multiparam.sh
spec "Multiparam process management"
bash ./test/bash/json-file.sh
spec "JSON file test"
bash ./test/bash/yaml-configuration.sh
spec "YAML configuration support"
bash ./test/bash/piped-config.sh
spec "Piped JSON file test"
bash ./test/bash/extra-lang.sh
spec "Various programming languages checks (Python, PHP)"
bash ./test/bash/json-reload.sh
spec "JSON reload test"
bash ./test/bash/homogen-json-action.sh
spec "Homogen json actions"
bash ./test/bash/app-config-update.sh
spec "CLI/JSON argument reload"
bash ./test/bash/start-consistency.sh
spec "Consistency between a JSON an CLI start"
bash ./test/bash/harmony.sh
spec "Harmony test"
bash ./test/bash/log-custom.sh
spec "Custom log timestamp"
bash ./test/bash/reload.sh
spec "Reload"
bash ./test/bash/right-exit-code.sh
spec "Verification exit code"
bash ./test/bash/log-reload.sh
spec "Log reload"
bash ./test/bash/gracefulReload.sh
spec "gracefulReload system 1"
bash ./test/bash/gracefulReload2.sh
spec "gracefulReload system 2"
bash ./test/bash/gracefulReload3.sh
spec "gracefulReload system 3"
bash ./test/bash/misc.sh
spec "MISC features"
bash ./test/bash/fork.sh
spec "Fork system working"
bash ./test/bash/get-set.sh
spec "Configuration system working"
bash ./test/bash/infinite-loop.sh
spec "Infinite loop stop"
bash ./test/bash/env-refresh.sh
spec "Environment refresh on restart"
bash ./test/bash/reset.sh
spec "Reset meta"
bash ./test/bash/startOrX.sh
spec "startOrX commands"
bash ./test/bash/binary.sh
spec "binary test"
bash ./test/bash/log-entire.sh
spec "merge stdout && stderr"
bash ./test/bash/module.sh
spec "module system"
bash ./test/bash/vizion.sh
spec "vizion features (versioning control)"
bash ./test/bash/wrapped-fork.sh
spec "wrapped fork"
bash ./test/bash/app-configuration.sh
spec "App configuration"
bash ./test/bash/source_map.sh
spec "Source map resolution on exception"
bash ./test/bash/inside-pm2.sh
spec "Starting a process inside a PM2 process"

bash ./test/bash/pm2-dev.sh
spec "pm2-dev"

$pm2 kill
