#!/usr/bin/env bash

export PM2_SILENT="true"

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/e2e/include.sh"

# Abort script at first error
set -e

touch e2e_time
> e2e_time

# CLI
runTest ./test/e2e/cli/reload.sh
runTest ./test/e2e/cli/start-app.sh
runTest ./test/e2e/cli/operate-regex.sh
runTest ./test/e2e/cli/bun.sh
runTest ./test/e2e/cli/app-configuration.sh
runTest ./test/e2e/cli/binary.sh
runTest ./test/e2e/cli/startOrX.sh
runTest ./test/e2e/cli/reset.sh
runTest ./test/e2e/cli/env-refresh.sh
runTest ./test/e2e/cli/extra-lang.sh
runTest ./test/e2e/cli/python-support.sh
runTest ./test/e2e/cli/multiparam.sh
runTest ./test/e2e/cli/smart-start.sh
runTest ./test/e2e/cli/args.sh
runTest ./test/e2e/cli/attach.sh
runTest ./test/e2e/cli/serve.sh

SUPV6=`node -e "require('semver').lt(process.versions.node, '6.0.0') ? console.log('<6') : console.log('>6')"`

if [ $SUPV6 = '<6' ]; then
    exit
fi

SUPES=`node -e "require('semver').satisfies(process.versions.node, '>=13.3.0') ? console.log(true) : console.log(false)"`

if [ $SUPES = 'true' ]; then
    runTest ./test/e2e/esmodule.sh
fi

runTest ./test/e2e/cli/monit.sh
runTest ./test/e2e/cli/cli-actions-1.sh
if [[ ! -v GITHUB_ACTIONS ]]; then 
    runTest ./test/e2e/cli/cli-actions-2.sh
fi
runTest ./test/e2e/cli/dump.sh
runTest ./test/e2e/cli/resurrect.sh
runTest ./test/e2e/cli/watch.sh
runTest ./test/e2e/cli/right-exit-code.sh
if [[ ! -v GITHUB_ACTIONS ]]; then 
    runTest ./test/e2e/cli/fork.sh
fi
runTest ./test/e2e/cli/piped-config.sh

# PROCESS FILES
runTest ./test/e2e/process-file/json-file.sh
runTest ./test/e2e/process-file/yaml-configuration.sh
runTest ./test/e2e/process-file/json-reload.sh
runTest ./test/e2e/process-file/homogen-json-action.sh
runTest ./test/e2e/process-file/app-config-update.sh
runTest ./test/e2e/process-file/js-configuration.sh

# BINARIES
runTest ./test/e2e/binaries/pm2-dev.sh
runTest ./test/e2e/binaries/pm2-runtime.sh

# INTERNALS
runTest ./test/e2e/internals/wait-ready-event.sh
runTest ./test/e2e/internals/daemon-paths-override.sh
runTest ./test/e2e/internals/source_map.sh
runTest ./test/e2e/internals/wrapped-fork.sh
runTest ./test/e2e/internals/infinite-loop.sh
runTest ./test/e2e/internals/options-via-env.sh
#runTest ./test/e2e/internals/promise.sh
runTest ./test/e2e/internals/increment-var.sh
runTest ./test/e2e/internals/start-consistency.sh

# MISC
runTest ./test/e2e/misc/inside-pm2.sh
runTest ./test/e2e/misc/vizion.sh
runTest ./test/e2e/misc/misc.sh
runTest ./test/e2e/misc/versioning-cmd.sh
runTest ./test/e2e/misc/instance-number.sh
runTest ./test/e2e/misc/startup.sh
runTest ./test/e2e/misc/nvm-node-version.sh
runTest ./test/e2e/misc/port-release.sh
runTest ./test/e2e/misc/cron-system.sh

# LOGS
runTest ./test/e2e/logs/log-custom.sh
runTest ./test/e2e/logs/log-reload.sh
runTest ./test/e2e/logs/log-entire.sh
runTest ./test/e2e/logs/log-null.sh
runTest ./test/e2e/logs/log-json.sh
runTest ./test/e2e/logs/log-create-not-exist-dir.sh
runTest ./test/e2e/logs/log-namespace.sh

# MODULES
runTest ./test/e2e/modules/get-set.sh
runTest ./test/e2e/modules/module.sh
runTest ./test/e2e/modules/module-safeguard.sh

$pm2 kill

echo "============== e2e test finished =============="
cat e2e_time

# cat ~/.pm2/pm2.log | grep "PM2 global error caught"
# spec "PM2 Daemon should not have thrown any global error"
