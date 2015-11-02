#!/bin/bash

has_command() {
  type $1 >/dev/null 2>&1 || { echo >&2 "'$1' command not found, aborting."; exit 1; }
}

has_command pm2
has_command node
has_command jq

# Replace with your pm2 path
pm2=pm2

log_command() {
  echo -e "\n\`$@\`: \n"
}

code_block() {
  echo "\`\`\`$1"
}

log() {
  log_command $@
  code_block
  echo $("$@")
  code_block
}

echo -e "\n*Describe your issue here*\n"

echo -e "\n## OS informations: \n"

log uname -a
log node -v
log $pm2 --version

echo -e "\n## PM2 informations: \n"

log_command $pm2 info
code_block json
$pm2 info --silent | jq .
code_block

pm2_home=$($pm2 info --silent | jq -r .PM2_ROOT_PATH)

if [[ "$pm2_home" == 'null' ]]; then
  echo "PM2_ROOT_PATH was not found"
  exit 1
fi

if [[ ! -d "$pm2_home" || -L "$pm2_home" ]]; then
  echo "Pm2 home ($pm2_home) is not a directory!"
  exit 1
fi

log_command tail -n 100 $pm2_home/pm2.log
code_block
tail -n 100 $pm2_home/pm2.log
code_block

log_command $pm2 jlist
code_block json
# silence output so that json is raw
$pm2 jlist --silent | jq .
code_block

log_command $pm2 list
code_block
$pm2 list
code_block
