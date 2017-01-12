#!/sbin/openrc-run

name=pm2
PM2="%PM2_PATH%"
pidfile=/root/.pm2/${name}.pid
user="%USER%"
export PATH=/usr/bin:$PATH
export PM2_HOME="/root/.pm2"

if [ "${user}" != "root" ]; then
	pidfile="/home/${user}/.pm2/${name}.pid"
	export PM2_HOME="/home/${user}/.pm2"
fi

depend() {
  need net
  need localmount
  after bootmisc
}

start() {
  ebegin "Starting pm2"

  start-stop-daemon --start --pidfile ${pidfile} --user ${user} --exec ${PM2} -- resurrect
  eend $?
}

stop() {
  ebegin "Stopping pm2"

  $PM2 dump
  $PM2 delete all
  $PM2 kill
  eend $?
  return 0
}

reload() {
  ebegin "Reloading pm2"

  $PM2 reload all
  eend $?
}
