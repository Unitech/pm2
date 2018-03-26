#!/usr/bin/env bash

#
# LSOF check
#

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path

echo "################## RELOAD ###################"

# lsof -c PM2 > /tmp/no_pm2_out.dat

# $pm2 list

# sleep 1
# lsof -c PM2 > /tmp/empty_pm2_out.dat

# $pm2 start echo.js -i 3
# $pm2 start killtoofast.js -i 3
# $pm2 delete all

# sleep 3
# lsof -c PM2 > /tmp/empty_pm2_out2.dat

# OUT1=`cat /tmp/empty_pm2_out.dat | wc -l`
# OUT2=`cat /tmp/empty_pm2_out2.dat | wc -l`

# if [ $OUT1 -eq $OUT2 ]; then
#   success "All file descriptors have been closed"
# else
#   fail "Some file descriptors are still open"
# fi

# $pm2 start killtoofast.js -i 6
# $pm2 kill

# rm /tmp/no_pm2_out.dat
# rm /tmp/no_pm2_out2.dat
# rm /tmp/empty_pm2_out.dat
# rm /tmp/empty_pm2_out2.dat

# sleep 6
> /tmp/no_pm_pm2_out.dat
> /tmp/no_pm_pm2_out2.dat

lsof -c PM2 > /tmp/no_pm2_out2.dat
diff /tmp/no_pm2_out.dat /tmp/no_pm2_out2.dat

if [ $? == "0" ]; then
  success "All file descriptors have been closed"
else
  fail "Some file descriptors are still open"
fi

rm /tmp/no_pm2_out.dat
rm /tmp/no_pm2_out2.dat
rm /tmp/empty_pm2_out.dat
rm /tmp/empty_pm2_out2.dat
