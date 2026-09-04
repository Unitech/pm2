/**
 * Copyright 2013-present the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
'use strict';

/**
 * @file Daemon-side stdout/stderr -> log files + bus, shared by fork and
 * cluster mode. In cluster mode the worker already intercepts
 * process.stdout.write in ProcessContainer.js, so what reaches the pipe
 * here is only what bypassed it: direct fd writes (pino/sonic-boom),
 * children spawned with stdio 'inherit' (npm start), native addons...
 */
var dayjs   = require('dayjs');
var Utility = require('../Utility.js');

/**
 * Bind `data` handlers on proc.stdout / proc.stderr
 * @param {Object} God
 * @param {Object} proc     ChildProcess-like object exposing stdout/stderr streams
 * @param {Object} pm2_env
 * @param {Object} stds     { out, err, std? } write streams (or raw paths when NULL)
 * @return {Object} { flush() } flush the pending partial line buffer
 */
function attach(God, proc, pm2_env, stds) {
  function transformLogToJson(type, data) {
    return JSON.stringify({
      message : data.toString(),
      timestamp : pm2_env.log_date_format ? dayjs().format(pm2_env.log_date_format) : new Date().toISOString(),
      type : type,
      process_id : pm2_env.pm_id,
      app_name : pm2_env.name
    }) + '\n';
  }

  // Pipe chunks are not line-aligned: keep the trailing partial line
  // per stream until the next chunk (or exit) completes it (#6125)
  var MAX_LINE_BUFFER = 1024 * 1024;
  var line_buf = { out: '', err: '' };

  function prefixLogWithDate(data, type) {
    var text = line_buf[type] + data.toString();
    var idx = text.lastIndexOf('\n');
    if (idx === -1) {
      if (text.length < MAX_LINE_BUFFER) {
        line_buf[type] = text;
        return '';
      }
      // no newline in sight: force flush to bound memory
      line_buf[type] = '';
      return `${dayjs().format(pm2_env.log_date_format)}: ${text}\n`;
    }
    line_buf[type] = text.slice(idx + 1);
    var ts = dayjs().format(pm2_env.log_date_format);
    return text.slice(0, idx).split('\n').map(line => `${ts}: ${line}\n`).join('');
  }

  function flushLineBuffer(type) {
    if (!line_buf[type]) return;
    var log_data = `${dayjs().format(pm2_env.log_date_format)}: ${line_buf[type]}\n`;
    line_buf[type] = '';
    var std = type === 'err' ? stds.err : stds.out;
    stds.std && stds.std.write && stds.std.write(log_data);
    std && std.write && std.write(log_data);
  }

  function onData(type) {
    var log_path = type === 'err' ? pm2_env.pm_err_log_path : pm2_env.pm_out_log_path;

    return function(data) {
      var log_data = null;

      // via --out /dev/null --err /dev/null
      if (pm2_env.disable_logs === true) return false;

      if (pm2_env.log_type && pm2_env.log_type === 'json')
        log_data = transformLogToJson(type, data);
      else if (pm2_env.log_date_format)
        log_data = prefixLogWithDate(data, type);
      else
        log_data = data.toString();

      if (log_data === '') return false;

      God.bus.emit('log:' + type, {
        process : {
          pm_id      : pm2_env.pm_id,
          name       : pm2_env.name,
          rev        : (pm2_env.versioning && pm2_env.versioning.revision) ? pm2_env.versioning.revision : null,
          namespace  : pm2_env.namespace
        },
        at  : Utility.getDate(),
        data : log_data
      });

      if (Utility.checkPathIsNull(log_path) &&
        (!pm2_env.pm_log_path || Utility.checkPathIsNull(pm2_env.pm_log_path)))
        return false;

      stds.std && stds.std.write && stds.std.write(log_data);
      stds[type] && stds[type].write && stds[type].write(log_data);
    };
  }

  proc.stderr && proc.stderr.on('data', onData('err'));
  proc.stdout && proc.stdout.on('data', onData('out'));

  return {
    flush: function() {
      if (pm2_env.log_date_format && !(pm2_env.log_type === 'json')) {
        flushLineBuffer('out');
        flushLineBuffer('err');
      }
    }
  };
}

/**
 * Prefer end() so buffered data is flushed before the fd is closed
 */
function close(stds) {
  for (var k in stds) {
    if (stds[k] && stds[k].end) stds[k].end();
    else if (stds[k] && stds[k].destroy) stds[k].destroy();
    else if (stds[k] && stds[k].close) stds[k].close();
    // NULL out/err never get a stream: keep the raw path (#5509)
    if (stds[k] && stds[k]._file) stds[k] = stds[k]._file;
  }
}

/**
 * Build the { out, err, std? } path map from pm2_env
 */
function stdsFromEnv(pm2_env) {
  var stds = {
    out: pm2_env.pm_out_log_path,
    err: pm2_env.pm_err_log_path
  };
  if ('pm_log_path' in pm2_env)
    stds.std = pm2_env.pm_log_path;
  return stds;
}

module.exports = {
  attach      : attach,
  close       : close,
  stdsFromEnv : stdsFromEnv
};
