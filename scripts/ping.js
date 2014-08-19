#!/bin/sh

':' // Hack to pass parameters to Node before running this file
':' //; [ -f ~/.pm2/custom_options.sh ] && . ~/.pm2/custom_options.sh || : ; exec "`command -v node || command -v nodejs`" $PM2_NODE_OPTIONS "$0" "$@"

var cst       = require('../constants.js');
var fs = require('fs');

try {
  var pm2_pid = fs.readFileSync(cst.PM2_PID_FILE_PATH);
} catch(e) {
  process.exit(1);
}

if (pm2_pid) {
  try {
    process.kill(parseInt(pm2_pid), 0);
    console.log('PM2 online');
    process.exit(0);
  }
  catch (err) {
    console.log('PM2 offline');
    process.exit(1);
  }
}
