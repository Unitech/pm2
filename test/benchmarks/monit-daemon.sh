#!/bin/bash

while [ true ]
do
    PM2_PID=`pgrep "pm2: Daemon" -o`

    # Run garbage collector
    kill -SIGILL $PM2_PID
    sleep 5

    FILE="/proc/$PM2_PID/smaps"
    Rss=`echo 0 $(cat $FILE  | grep Rss | awk '{print $2}' | sed 's#^#+#') | bc;`

    echo `date +%H:%M:%S` $Rss >> $RESULT_FILE
    sleep 100
done
