#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/bash/include.sh"

# Abort script at first error
set -e
# Display all commands executed
set -o verbose

echo "####################### DEBUG ############################"
echo "PM2 Command = " $pm2
echo "Node version = " $nodeVersion
$node -e "var os = require('os'); console.log('arch : %s\nplatform : %s\nrelease : %s\ntype : %s\nmem : %d', os.arch(), os.platform(), os.release(), os.type(), os.totalmem())"
echo "###################### !DEBUG! ###########################"

debug() { echo "DEBUG: $*" >&2; }

waitall() { # PID...
    ## Wait for children to exit and indicate whether all exited with 0 status.
    local errors=0
    local pids=$@
    while :; do
        debug "Processes remaining: $*"
        for pid in "$@"; do
            shift
            if kill -0 "$pid" 2>/dev/null; then
                debug "$pid is still alive."
                set -- "$@" "$pid"
            elif wait "$pid"; then
                debug "$pid exited with zero exit status."
            else
                debug "$pid exited with non-zero exit status."
                kill $pids
                exit 1
                ((++errors))
            fi
        done
        (("$#" > 0)) || break
        # TODO: how to interrupt this sleep when a child terminates?
        sleep ${WAITALL_DELAY:-1}
    done
    ((errors == 0))

}
pkill -f PM2; pkill -f pm2

PM2_HOME='.pm2' bash ./test/bash/cli.sh &

PM2_HOME='.pm3' bash ./test/bash/watch.sh &

PM2_HOME='.pm4' bash ./test/bash/json_file.sh &

PM2_HOME='.pm5' bash ./test/bash/harmony.sh &

pids=`jobs -p`
waitall $pids
