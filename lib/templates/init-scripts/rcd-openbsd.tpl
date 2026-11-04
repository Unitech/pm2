#!/bin/ksh
#
# from /usr/ports/infrastructure/templates/rc.template

daemon="/usr/local/bin/pm2"
#daemon_flags=
#daemon_rtable=0
#daemon_timeout="30"
daemon_user="%USER%"

. /etc/rc.d/rc.subr

pexp="node: PM2.*God Daemon.*"
#rc_bg= # (undefined)
#rc_reload= # (undefined)
#rc_usercheck=YES

#rc_pre() {
#}

rc_start() {
	${rcexec} "${daemon} ${daemon_flags} resurrect"
}

#rc_check() {
#	pgrep -T "${daemon_rtable}" -q -xf "${pexp}"
#}

rc_reload() {
	${rcexec} "${daemon} reload all"
	#pkill -HUP -T "${daemon_rtable}" -xf "${pexp}"
}

#rc_stop() {
#	pkill -T "${daemon_rtable}" -xf "${pexp}"
#}

#rc_post() {
#}

rc_cmd $1
