#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/e2e/include.sh"

# Abort script at first error
set -e
set -o verbose

# CLI
bash ./test/e2e/cli/reload.sh
spec "Reload"
bash ./test/e2e/cli/start-app.sh
spec "Command line passing"
bash ./test/e2e/cli/operate-regex.sh
spec "Operate process that match regex"
bash ./test/e2e/cli/interpreter.sh
spec "Javascript transpilers tests"
bash ./test/e2e/cli/app-configuration.sh
spec "App configuration"
bash ./test/e2e/cli/binary.sh
spec "binary test"
bash ./test/e2e/cli/startOrX.sh
spec "startOrX commands"
bash ./test/e2e/cli/reset.sh
spec "Reset meta"
bash ./test/e2e/cli/env-refresh.sh
spec "Environment refresh on restart"
bash ./test/e2e/cli/extra-lang.sh
spec "Various programming languages checks (Python, PHP)"
bash ./test/e2e/cli/python-support.sh
spec "Python support checks"
bash ./test/e2e/cli/multiparam.sh
spec "Multiparam process management"
bash ./test/e2e/cli/smart-start.sh
spec "smart start test"
bash ./test/e2e/cli/args.sh
spec "check arguments passing"
bash ./test/e2e/cli/attach.sh
spec "pm2 attach method"
bash ./test/e2e/cli/serve.sh
spec "pm2 serve CLI method"
bash ./test/e2e/cli/monit.sh
spec "km selective monitoring "
bash ./test/e2e/cli/cli-actions-1.sh
spec "CLI basic test"
bash ./test/e2e/cli/cli-actions-2.sh
spec "Second hard cli tests"
bash ./test/e2e/cli/dump.sh
spec "dump test"
bash ./test/e2e/cli/resurrect.sh
spec "resurrect test"
bash ./test/e2e/cli/mjs.sh
spec "Test import syntax"
bash ./test/e2e/cli/watch.sh
spec "watch system tests"
bash ./test/e2e/cli/right-exit-code.sh
spec "Verification exit code"
bash ./test/e2e/cli/fork.sh
spec "Fork system working"
bash ./test/e2e/cli/piped-config.sh
spec "Piped JSON file test"

# PROCESS FILES
bash ./test/e2e/process-file/json-file.sh
spec "JSON file test"
bash ./test/e2e/process-file/yaml-configuration.sh
spec "YAML configuration support"
bash ./test/e2e/process-file/json-reload.sh
spec "JSON reload test"
bash ./test/e2e/process-file/homogen-json-action.sh
spec "Homogen json actions"
bash ./test/e2e/process-file/app-config-update.sh
spec "CLI/JSON argument reload"
bash ./test/e2e/process-file/js-configuration.sh
spec "js configuration support"

# BINARIES
bash ./test/e2e/binaries/pm2-dev.sh
spec "pm2-dev"
bash ./test/e2e/binaries/pm2-runtime.sh
spec "pm2-runtime"

# INTERNALS
bash ./test/e2e/internals/wait-ready-event.sh
spec "Wait for application ready event"
bash ./test/e2e/internals/daemon-paths-override.sh
spec "Override daemon configuration paths"
bash ./test/e2e/internals/source_map.sh
spec "Source map resolution on exception"
bash ./test/e2e/internals/wrapped-fork.sh
spec "wrapped fork"
bash ./test/e2e/internals/infinite-loop.sh
spec "Infinite loop stop"
bash ./test/e2e/internals/options-via-env.sh
spec "set option via environment"
bash ./test/e2e/internals/promise.sh
spec "Promise warning message tests"
bash ./test/e2e/internals/increment-var.sh
spec "Increment env variables"
bash ./test/e2e/internals/start-consistency.sh
spec "Consistency between a JSON an CLI start"

# MISC
bash ./test/e2e/misc/inside-pm2.sh
spec "Starting a process inside a PM2 process"
bash ./test/e2e/misc/vizion.sh
spec "vizion features (versioning control)"
bash ./test/e2e/misc/misc.sh
spec "MISC features"
bash ./test/e2e/misc/versioning-cmd.sh
spec "versioning system tests"
bash ./test/e2e/misc/instance-number.sh
spec "Negative instance number spawn one worker"
bash ./test/e2e/misc/startup.sh
spec "upstart startup test"
bash ./test/e2e/misc/nvm-node-version.sh
spec "NVM node version setting"
bash ./test/e2e/misc/cron-system.sh
spec "Cron system tests"

# LOGS
bash ./test/e2e/logs/log-timestamp.sh
spec "timestamp prefix of pm2.log"
bash ./test/e2e/logs/log-custom.sh
spec "Custom log timestamp"
bash ./test/e2e/logs/log-reload.sh
spec "Log reload"
bash ./test/e2e/logs/log-entire.sh
spec "merge stdout && stderr"
bash ./test/e2e/logs/log-null.sh
spec "Logging path set to null"
bash ./test/e2e/logs/log-json.sh
spec "Logging directly to file in json"

# MODULES
bash ./test/e2e/modules/get-set.sh
spec "Configuration system working"
bash ./test/e2e/modules/module.sh
spec "module system"
bash ./test/e2e/modules/module-safeguard.sh
spec "module safeguard system (--safe)"

$pm2 kill
