#!/bin/bash

RESULT_FILE=result.monit

export RESULT_FILE=$RESULT_FILE

launch() {
    echo "========= `date`" >> $RESULT_FILE
    nohup ./monit-daemon.sh &> monit.log &    
}

ppkill() {
    pkill -f monit-daemon.sh ; pkill -f sleep
}

case "$1" in
    start)
        launch
        ;;
    kill)
        ppkill
        ;;
    stop)
        ppkill
        ;;
    restart)
        ppkill
        launch
        ;;
    *)
        echo "Usage: {start|kill|stop|restart}"
        exit 1
        ;;
esac
exit $RETVAL
