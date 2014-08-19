#!/bin/bash

':' // Hack to pass parameters to Node before running this file
':' //; [ -f ~/.pm2/custom_options.sh ] && . ~/.pm2/custom_options.sh || : ; exec "`command -v node || command -v nodejs`" $PM2_NODE_OPTIONS "$0" "$@"

var cst       = require('../constants.js');
var fs = require('fs');

var pm2_pid = null;
var interactor_pid = null;

try {
  pm2_pid = fs.readFileSync(cst.PM2_PID_FILE_PATH);
} catch(e) {
  process.exit(1);
}

try {
  interactor_pid = fs.readFileSync(cst.INTERACTOR_PID_PATH);
} catch(e) {
}

if (interactor_pid) {
  try {
    process.kill(interactor_pid);
  }
  catch (err) {
  }
}

if (pm2_pid) {
  try {
    process.kill(pm2_pid);
    process.exit(0);
  }
  catch (err) {
    process.exit(1);
  }
}
