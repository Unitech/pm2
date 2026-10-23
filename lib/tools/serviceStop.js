/**
 * Copyright 2013-present the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
'use strict';

/**
 * Guard for `pm2 kill` run as a systemd stop command (ExecStop=pm2 kill
 * from `pm2 startup`).
 *
 * systemd runs the stop commands even when the main process exited on its own.
 * During `pm2 update` the old daemon (the unit main PID) exits, and `pm2 kill`
 * then reaches the new daemon spawned by `pm2 update` outside the unit and
 * kills it with all its apps (#5000).
 *
 * Rule: when the main process is gone, a stop command only acts on a daemon
 * started by this run of the unit, and never spawns one.
 */

var fs = require('fs');

var RPC_TIMEOUT = 3000;

/**
 * Stop context of the current process, or null when the guard does not apply
 *
 * - only `pm2 kill`: other commands in a stop command (`ExecStop=pm2 delete web`
 *   of a oneshot unit, which never has a MAINPID) keep their behavior
 * - SERVICE_RESULT is only set for ExecStop/ExecStopPost (systemd >= 232),
 *   never for the main process tree (CI runner jobs, apps...)
 * - MAINPID is only set while the unit main process is alive: then it is an
 *   operator stop (systemctl stop/restart, shutdown), keep the normal behavior
 */
function getStopContext(env, args) {
  var command = (args || []).filter(function(a) { return a[0] !== '-'; })[0];

  if (command !== 'kill')
    return null;
  if (env.SERVICE_RESULT === undefined || !env.INVOCATION_ID || env.MAINPID)
    return null;
  return { invocation_id : env.INVOCATION_ID };
}

/**
 * Unit cgroup path from /proc/<pid>/cgroup content (v2 or v1 name=systemd),
 * systemd >= 256 runs control commands in a `.control` sub-cgroup
 */
function parseCgroup(content) {
  if (!content) return null;
  var lines = content.split('\n');
  var found = null;

  for (var i = 0; i < lines.length; i++) {
    var parts = lines[i].split(':');
    if (parts.length < 3) continue;
    if ((parts[0] === '0' && parts[1] === '') || parts[1] === 'name=systemd') {
      found = parts.slice(2).join(':');
      if (parts[0] === '0') break;
    }
  }
  return found ? found.replace(/\/\.control$/, '') : null;
}

/**
 * @param {Object} ctx            getStopContext() result
 * @param {Object} report         daemon getReport() result, null if no daemon answered
 * @param {String} self_cgroup    /proc/self/cgroup content
 * @param {String} daemon_cgroup  /proc/<daemon pid>/cgroup content
 * @return {Object} { action: 'run' | 'skip', reason: String }
 */
function decide(ctx, report, self_cgroup, daemon_cgroup) {
  if (!report)
    return { action : 'skip', reason : 'no running daemon, nothing to do' };

  // daemon spawned by this unit run (ExecStart=pm2 resurrect): oneshot units...
  if (report.env && report.env.INVOCATION_ID === ctx.invocation_id)
    return { action : 'run', reason : 'daemon started by this service' };

  // a real stop command runs in the unit cgroup: only trust a .service one
  var self = parseCgroup(self_cgroup);
  if (self && /\.service$/.test(self) && self === parseCgroup(daemon_cgroup))
    return { action : 'run', reason : 'daemon in this service cgroup' };

  return { action : 'skip', reason : 'daemon not started by this service (pm2 update?), leaving it running' };
}

function readCgroup(pid) {
  try {
    return fs.readFileSync('/proc/' + pid + '/cgroup', 'utf8');
  } catch(e) {
    return null;
  }
}

/**
 * Ask the running daemon for its report with a dedicated RPC client: never
 * through Client.start/executeRemote, which spawn a daemon when none answers
 *
 * @param {String} rpc_socket_file
 * @param {Function} cb invoked with <report|null>, never fails
 */
function getDaemonReport(rpc_socket_file, cb) {
  var axon = require('../../modules/pm2-axon');
  var rpc  = require('../../modules/pm2-axon-rpc');
  var req  = axon.socket('req');
  var client = new rpc.Client(req);
  var called = false;

  function done(report) {
    if (called) return;
    called = true;
    clearTimeout(timer);
    try { req.close(); } catch(e) {}
    cb(report || null);
  }

  var timer = setTimeout(done, RPC_TIMEOUT);

  // socket errors (ENOENT, ECONNREFUSED, EACCES...) mean no usable daemon
  req.on('error', function() { done(); });
  req.once('reconnect attempt', function() { done(); });
  req.once('connect', function() {
    client.call('getReport', {}, function(err, report) {
      done(err ? null : report);
    });
  });

  req.connect(rpc_socket_file);
}

/**
 * @param {Object} ctx getStopContext() result
 * @param {String} rpc_socket_file
 * @param {Function} cb invoked with <decision>
 */
function check(ctx, rpc_socket_file, cb) {
  getDaemonReport(rpc_socket_file, function(report) {
    var daemon_cgroup = report && report.pid ? readCgroup(report.pid) : null;
    cb(decide(ctx, report, readCgroup('self'), daemon_cgroup));
  });
}

module.exports = {
  getStopContext : getStopContext,
  parseCgroup    : parseCgroup,
  decide         : decide,
  check          : check
};
