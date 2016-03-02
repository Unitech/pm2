#!/bin/sh

# PROVIDE: pm2
# REQUIRE: LOGIN
# KEYWORD: shutdown

. /etc/rc.subr

name=pm2
rcvar=${name}_enable

load_rc_config $name

: ${pm2_user="%USER%"}

command="%PM2_PATH%"
pidfile="/home/${pm2_user}/.pm2/${name}.pid"
start_cmd="${name}_start"
stop_cmd="${name}_stop"
reload_cmd="${name}_reload"
status_cmd="${name}_status"

extra_commands="reload"

super() {
        su - "${pm2_user}" -c "$*"
}

pm2_start() {
        unset "${rc_flags}_cmd"
        if pm2_running; then
                echo "Pm2 is already running, 'pm2 list' to see running processes"
        else
                echo "Starting pm2."
                super $command resurrect
        fi
}

pm2_stop() {
        echo "Stopping ${name}..."
        #super $command dump
        super $command delete all
        super $command kill
}

pm2_reload() {
        echo "Reloading ${name}"
        super $command reload all
}

pm2_status() {
        super $command list
}

pm2_running() {
        process_id=$(pgrep -F ${pidfile})
        if [ "${process_id}" -gt 0 ]; then
                return 0
        else
                return 1
        fi
}

run_rc_command "$1"
