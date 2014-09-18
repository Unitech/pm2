#!/bin/bash

':' // Hack to pass parameters to Node before running this file
':' //; [ -f ~/.pm2/custom_options.sh ] && . ~/.pm2/custom_options.sh || : ; exec "`command -v node || command -v nodejs`" $PM2_NODE_OPTIONS "$0" "$@"

var cst       = require('../constants.js');
var fs = require('fs');
var pm2 = require('..');

function killEverything() {
  var pm2_pid = null;
  var interactor_pid = null;

  try {
    pm2_pid = fs.readFileSync(cst.PM2_PID_FILE_PATH);
  } catch(e) {
    console.log('PM2 pid file EEXIST');
    process.exit(1);
  }

  try {
    interactor_pid = fs.readFileSync(cst.INTERACTOR_PID_PATH);
  } catch(e) {
  }

  if (interactor_pid) {
    try {
      console.log('[PM2] Killing interactor');
      process.kill(interactor_pid);
    }
    catch (err) {
    }
  }

  if (pm2_pid) {
    try {
      console.log('[PM2] Killing PM2');
      process.kill(pm2_pid);
    }
    catch (err) {
    }
  }

  setTimeout(function() {
    process.exit(0);
  }, 100);
}


var fallback = require('pm2-rpc-fallback').fallback;

fallback(cst, function(err, data) {
  if (err && err.online) {
      // Right RPC communcation
    return process.exit(1);
  }
  else if (err && err.offline) {
        console.log('[PM2] Online');
    return process.exit(0);
  }
  else if (err) {
    return killEverything();
  }
  if (data) {
    console.log('[PM2] Killing old PM2');
    return killEverything();
  }
  return false;
});
