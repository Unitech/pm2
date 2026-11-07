
const cst = require('../../../constants')
const Common = require('../../Common')
const UxHelpers = require('./helpers.js')
const chalk = require('ansis')
const Table = require('cli-tableau')
const Passwd = require('../../tools/passwd.js')

const CONDENSED_MODE = (process.stdout.columns || 300) < 134

/**
 * Extract port information from process
 * Priority: 1. env.PORT, 2. CLI args, 3. Other env vars
 */
function extractPorts(proc) {
  const pm2_env = proc.pm2_env;
  const ports = [];

  // 1. HIGHEST PRIORITY: Ecosystem config (env.PORT)
  // PM2 already converts app.port → app.env.PORT in Common.js:140-142
  if (pm2_env.env && pm2_env.env.PORT) {
    ports.push(pm2_env.env.PORT);
  }

  // 2. MEDIUM PRIORITY: Parse CLI args
  if (pm2_env.args) {
    // Handle both string and array formats
    const args = Array.isArray(pm2_env.args) ? pm2_env.args :
                 (typeof pm2_env.args === 'string' ?
                   JSON.parse(pm2_env.args.replace(/'/g, '"')) : []);

    // Parse port arguments
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      // Match: --port 3000, -p 3000
      if ((arg === '--port' || arg === '-p') && args[i + 1]) {
        const nextArg = args[i + 1];
        if (!isNaN(nextArg)) {
          ports.push(nextArg);
          i++; // Skip next arg
        }
      }
      // Match: --port=3000
      else if (arg.match(/^--port=(\d+)$/)) {
        ports.push(RegExp.$1);
      }
      // Match: -p3000 or -p=3000
      else if (arg.match(/^-p=?(\d+)$/)) {
        ports.push(RegExp.$1);
      }
      // Also check for other common port flags
      else if (arg === '--http-port' && args[i + 1]) {
        const nextArg = args[i + 1];
        if (!isNaN(nextArg)) {
          ports.push(nextArg);
          i++;
        }
      }
      else if (arg.match(/^--http-port=(\d+)$/)) {
        ports.push(RegExp.$1);
      }
    }
  }

  // 3. LOW PRIORITY: Check other env variables (only if no port found)
  if (ports.length === 0 && pm2_env.env) {
    const envVars = ['HTTP_PORT', 'HTTPS_PORT', 'API_PORT', 'SERVER_PORT'];
    for (const envVar of envVars) {
      if (pm2_env.env[envVar]) {
        ports.push(pm2_env.env[envVar]);
      }
    }
  }

  // Return unique ports as comma-separated string
  const uniquePorts = [...new Set(ports)].filter(p => p && !isNaN(p));
  return uniquePorts.length > 0 ? uniquePorts.join(',') : '-';
}

/**
 * Display process list with port information
 */
module.exports = function(list, commander) {
  if (!list || list.length === 0) {
    return console.log('No processes running');
  }

  // Filter out modules, show only applications
  const apps = list.filter(proc => proc.pm2_env.pmx_module !== true);

  if (apps.length === 0) {
    return console.log('No applications running');
  }

  // Calculate name column width dynamically
  var name_col_size = 11;
  if (apps.length > 0) {
    name_col_size = (apps.reduce((p, c) => (p.name.length > c.name.length) ? p : c)).name.length + 5;
  }

  // Calculate ID column width
  const id_width = Math.max(
    2 + (Math.max(...apps.map((l) => String(l.pm2_env.pm_id || 0).length)) || 0),
    4
  );

  // Define table headers
  var app_head = CONDENSED_MODE ? {
    id: id_width,
    name: 20,
    mode: 10,
    '↺': 6,
    status: 11,
    port: 10,
    cpu: 10,
    memory: 10
  } : {
    id: id_width,
    name: name_col_size,
    namespace: 13,
    mode: 9,
    pid: 10,
    port: 10,
    uptime: 8,
    '↺': 6,
    status: 11,
    cpu: 10,
    mem: 10,
    user: 10
  };

  var app_table = new Table({
    head: Object.keys(app_head),
    colWidths: Object.keys(app_head).map(k => app_head[k]),
    colAligns: ['left'],
    style: {'padding-left': 1, head: ['cyan', 'bold'], compact: true}
  });

  // Sorting logic (same as pm2-ls.js)
  var sortField = 'name', sortOrder = 'asc', sort,
      fields = {
        name: 'pm2_env.name',
        namespace: 'pm2_env.namespace',
        pid: 'pid',
        id: 'pm_id',
        cpu: 'monit.cpu',
        memory: 'monit.memory',
        uptime: 'pm2_env.pm_uptime',
        status: 'pm2_env.status'
      };

  if (commander && commander.sort) {
    sort = commander.sort.split(':');

    if (fields[sort[0].toLowerCase()]) {
      sortField = sort[0].toLowerCase();
      sortOrder = sort.length === 2 ? sort[1] : 'asc';
    }
  }

  apps.sort(function(a, b) {
    var fieldA = UxHelpers.getNestedProperty(fields[sortField], a)
    var fieldB = UxHelpers.getNestedProperty(fields[sortField], b)

    if (sortOrder === 'desc') {
      if (fieldA > fieldB)
        return -1
      if (fieldA < fieldB)
        return 1
    } else {
      if (fieldA < fieldB)
        return -1
      if (fieldA > fieldB)
        return 1
    }
    return 0
  })

  // Populate table
  apps.forEach(function(l) {
    var obj = {}

    var mode = l.pm2_env.exec_mode
    var status = l.pm2_env.status
    var key = l.pm2_env.pm_id
    key = chalk.bold.cyan(key)

    obj[key] = []

    // Name
    obj[key].push(l.pm2_env.name)

    // Namespace (full mode only)
    if (!CONDENSED_MODE)
      obj[key].push(l.pm2_env.namespace)

    // Exec mode
    obj[key].push(mode == 'fork_mode' ? chalk.inverse.bold('fork') : chalk.blue.bold('cluster'))

    // PID (full mode only)
    if (!CONDENSED_MODE)
      obj[key].push(l.pid)

    // PORT (full mode only - comes after PID)
    if (!CONDENSED_MODE) {
      const ports = extractPorts(l);
      obj[key].push(ports === '-' ? chalk.gray(ports) : chalk.green.bold(ports));
    }

    // Uptime (full mode only)
    if (!CONDENSED_MODE)
      obj[key].push((l.pm2_env.pm_uptime && status == 'online') ? UxHelpers.timeSince(l.pm2_env.pm_uptime) : 0)

    // Restart count
    obj[key].push(l.pm2_env.restart_time ? l.pm2_env.restart_time : 0)

    // Status
    obj[key].push(UxHelpers.colorStatus(status))

    // PORT (condensed mode only - comes after status)
    if (CONDENSED_MODE) {
      const ports = extractPorts(l);
      obj[key].push(ports === '-' ? chalk.gray(ports) : chalk.green.bold(ports));
    }

    // CPU
    obj[key].push(l.monit ? l.monit.cpu + '%' : 'N/A')

    // Memory
    obj[key].push(l.monit ? UxHelpers.bytesToSize(l.monit.memory, 1) : 'N/A')

    // User (full mode only)
    if (!CONDENSED_MODE) {
      if (l.pm2_env.uid && typeof(l.pm2_env.uid) == 'number') {
        // Resolve user id to username
        let users = Passwd.getUsers()
        Object.keys(users).forEach(function(username) {
          var user = users[username]
          if (user.userId == l.pm2_env.uid) {
            l.pm2_env.uid = user.username
          }
        })
      }
      obj[key].push(chalk.bold(l.pm2_env.uid || l.pm2_env.username))
    }

    UxHelpers.safe_push(app_table, obj)
  })

  // Print table
  console.log(app_table.toString())
  console.log('')
  console.log(chalk.white.italic(' Use `pm2 describe <id|name>` to get more details'))
}
