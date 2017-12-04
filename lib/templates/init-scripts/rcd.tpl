#!/bin/sh

# PROVIDE: pm2
# REQUIRE: LOGIN
# KEYWORD: shutdown

. /etc/rc.subr

name="%SERVICE_NAME%"
rcvar="%SERVICE_NAME%_enable"

start_cmd="pm2_start"
stop_cmd="pm2_stop"
reload_cmd="pm2_reload"
status_cmd="pm2_status"
extra_commands="reload status"

pm2()
{
  env PATH="$PATH:%NODE_PATH%" PM2_HOME="%HOME_PATH%" su -m "%USER%" -c "%PM2_PATH% $*"
}

pm2_start()
{
  pm2 resurrect
}

pm2_stop()
{
  pm2 kill
}

pm2_reload()
{
  pm2 reload all
}

pm2_status()
{
  pm2 list
}

load_rc_config $name
run_rc_command "$1"
