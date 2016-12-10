#!/bin/bash
### BEGIN INIT INFO
# Provides:        pm2
# Required-Start:  $local_fs $remote_fs $network
# Required-Stop:   $local_fs $remote_fs $network
# Default-Start:   2 3 4 5
# Default-Stop:    0 1 6
# Short-Description: PM2 Init script
# Description: PM2 process manager
### END INIT INFO

NAME=pm2
PM2=%PM2_PATH%
USER=%USER%
DEFAULT=/etc/default/$NAME

export PATH=%NODE_PATH%:$PATH
export PM2_HOME="%HOME_PATH%"

# The following variables can be overwritten in $DEFAULT

# maximum number of open files
MAX_OPEN_FILES=

# overwrite settings from default file
if [ -f "$DEFAULT" ]; then
	  . "$DEFAULT"
fi

# set maximum open files if set
if [ -n "$MAX_OPEN_FILES" ]; then
    ulimit -n $MAX_OPEN_FILES
fi

get_user_shell() {
    local shell=$(getent passwd ${1:-`whoami`} | cut -d: -f7 | sed -e 's/[[:space:]]*$//')

    if [[ $shell == *"/sbin/nologin" ]] || [[ $shell == "/bin/false" ]] || [[ -z "$shell" ]];
    then
      shell="/bin/bash"
    fi

    echo "$shell"
}

super() {
    local shell=$(get_user_shell $USER)
    su - $USER -s $shell -c "PATH=$PATH; PM2_HOME=$PM2_HOME $*"
}

start() {
    echo "Starting $NAME"
    super $PM2 resurrect
}

stop() {
    super $PM2 kill
}

restart() {
    echo "Restarting $NAME"
    stop
    start
}

reload() {
    echo "Reloading $NAME"
    super $PM2 reload all
}

status() {
    echo "Status for $NAME:"
    super $PM2 list
    RETVAL=$?
}

case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    status)
        status
        ;;
    restart)
        restart
        ;;
    reload)
        reload
        ;;
    force-reload)
        reload
        ;;
    *)
        echo "Usage: {start|stop|status|restart|reload|force-reload}"
        exit 1
        ;;
esac
exit $RETVAL
