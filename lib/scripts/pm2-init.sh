#!/bin/bash
#
#
# description: PM2 next gen process manager for Node.js
# processname: pm2
#
### BEGIN INIT INFO
# Provides:          pm2
# Required-Start:    pm2
# Required-Stop:     
# Should-Start:      
# Should-Stop:
# Default-Start:     
# Default-Stop:
# Short-Description: PM2 init script
# Description: PM2 is the next gen process manager for Node.js
### END INIT INFO

NAME=pm2
PM2=%PM2_PATH%
NODE=%NODE_PATH%
NPM2=$NODE $PM2

export HOME="%HOME_PATH%"
 
start() {
    echo "Starting $NAME"
    $NODE $PM2 stop
    $NODE $PM2 resurrect
}
 
stop() {
    $NODE $PM2 dump
    $NODE $PM2 stop
}
 
restart() {
    echo "Restarting $NAME"
    stop
    start
}
 
status() {
    echo "Status for $NAME:"
    $NODE $PM2 list
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
    *)
        echo "Usage: {start|stop|status|restart}"
        exit 1
        ;;
esac
exit $RETVAL
