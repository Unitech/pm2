#!/bin/bash

':' // Hack to pass parameters to Node before running this file
':' //; [ -f ~/.pm2/custom_options.sh ] && . ~/.pm2/custom_options.sh || : ; exec "`command -v node || command -v nodejs`" $PM2_NODE_OPTIONS "$0" "$@"

var cst       = require('../constants.js');
var fs = require('fs');
var pm2 = require('..');

var pm2_pid = null;
var interactor_pid = null;
var version_file = null;

function killEverything() {
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
    console.log('Killing interactor');
    try {
      process.kill(interactor_pid);
    }
    catch (err) {
    }
  }

  if (pm2_pid) {
    try {
      console.log('Killing PM2');
      process.kill(pm2_pid);
      process.exit(0);
    }
    catch (err) {
      process.exit(1);
    }
  }

}


var fallback = require('pm2-rpc-fallback').fallback;

fallback(cst, function(err, data) {
  if (err && err.online) {
    // Right RPC communcation
    console.log('Stopping PM2');
    pm2.connect(function() {
      pm2.dump(function() {
        console.log('Succesfully dumped');
        pm2.disconnect(function() {
          killEverything();
          process.exit(0);
        });
      });
    });
    return false;
  }
  else if (err && err.offline) {
    console.log('PM2 already offline');
    return process.exit(0);
  }
  else if (err) {
    return console.log('Unhandled error, please report https://github.com/Unitech/pm2/issues');
  }
  if (data) {
    console.log('Killing old PM2');
    return killEverything();
  }
  return false;
});
