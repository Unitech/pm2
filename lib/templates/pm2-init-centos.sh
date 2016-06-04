#!/bin/bash
#
# pm2 Process manager for NodeJS
#
# chkconfig: 345 80 20
#
# description: PM2 next gen process manager for Node.js
# processname: pm2
#
### BEGIN INIT INFO
# Provides:          pm2
# Required-Start: $local_fs $remote_fs
# Required-Stop: $local_fs $remote_fs
# Should-Start: $network
# Should-Stop: $network
# Default-Start:        2 3 4 5
# Default-Stop:         0 1 6
# Short-Description: PM2 init script
# Description: PM2 is the next gen process manager for Node.js
### END INIT INFO

NAME=pm2
PM2=%PM2_PATH%
USER=%USER%

export PATH=%NODE_PATH%:$PATH
export PM2_HOME="%HOME_PATH%"

lockfile="/var/lock/subsys/pm2-init.sh"

super() {
    su - $USER -c "PATH=$PATH; PM2_HOME=$PM2_HOME $*"
}

start() {
    echo "Starting $NAME"
    super $PM2 resurrect
    retval=$?
    [ $retval -eq 0 ] && touch $lockfile
}

stop() {
    echo "Stopping $NAME"
    #super $PM2 dump
    super $PM2 delete all
    super $PM2 kill
    rm -f $lockfile
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
    *)
        echo "Usage: {start|stop|status|restart|reload}"
        exit 1
        ;;
esac
exit $RETVAL
