![PM2](https://github.com/unitech/pm2/raw/master/pres/pm2.20d3ef.png)


Master: [![Build Status](https://api.travis-ci.org/Unitech/PM2.png?branch=master)](https://travis-ci.org/Unitech/PM2)
Development: [![Build Status](https://api.travis-ci.org/Unitech/PM2.png?branch=development)](https://travis-ci.org/Unitech/PM2)

## Table of contents

### Quick start

- [Installation](#a1)
- [Usage](#a2)
- [Examples](#a3)
- [Different ways to launch a process](#a667)
- [Options](#a987)
- [How to update PM2?](#update-pm2)

### Features

- [Transitional state of apps](#a4)
- [Process listing](#a6)
- [Automatic restart process based on memory](#max-memory-restart)
- [Monitoring CPU/Memory usage](#a7)
- [Logs management](#a9)
- [Clustering](#a5)
- [Watch & Restart](#a890)
- [Reloading without downtime](#a690)
- [Make PM2 restart on server reboot](#a8)
- [JSON app declaration](#a10)

### Deployment - ecosystem.json

- [Getting started with deployment](#deployment)
- [Deployment options](#deployment-help)
- [Considerations](#considerations)
- [Contributing](#deployment-contribution)

### Using PM2 programmatically (via API)

- [Simple example](#programmatic-example)
- [Programmatic API](#programmatic-api)

### Specific

- [Specific features](#a77)
- [Configuration file](#a989)
- [Enabling Harmony ES6](#a66)
- [CoffeeScript](#a19)
- [Testing PM2 on your prod environment](#a149)
- [JSON app via pipe](#a96)

### Knowledge

- [Stateless apps ?](#stateless-apps)
- [Transitional state of apps](#a4)
- [Setup PM2 on server: tutorial](#a89)
- [Logs and PID files](#a34)
- [Execute any script: What is fork mode ?](#a23)

### More

- [Contributing/Development mode](#a27)
- [Known bugs and workaround](#a21)
- [They talk about it](#a20)
- [License](#a15)

------

# Quick start

<a name="a1"/>
## Installation

The latest PM2 stable version is installable via NPM:

```bash
$ npm install pm2@latest -g
```

If the above fails use:

```bash
$ npm install git://github.com/Unitech/pm2#master -g
```

We recommend Node.JS 0.11.14 for handling the cluster_mode (if you add the -i options to enable scaling and reload).

<a name="a2"/>
## Usage

Hello world:

```bash
$ pm2 start app.js
```

<a name="a3"/>
## Raw Examples

```bash
# Fork mode
$ pm2 start app.js --name my-api # Name process

# Cluster mode
$ pm2 start app.js -i max        # Will start maximum processes with LB depending on available CPUs

# Listing

$ pm2 list               # Display all processes status
$ pm2 jlist              # Print process list in raw JSON
$ pm2 prettylist         # Print process list in beautified JSON

$ pm2 describe 0         # Display all informations about a specific process

$ pm2 monit              # Monitor all processes

# Logs

$ pm2 logs               # Display all processes logs in streaming
$ pm2 ilogs              # Advanced termcaps interface to display logs
$ pm2 flush              # Empty all log file
$ pm2 reloadLogs         # Reload all logs

# Actions

$ pm2 stop all           # Stop all processes
$ pm2 restart all        # Restart all processes

$ pm2 reload all         # Will 0s downtime reload (for NETWORKED apps)
$ pm2 gracefulReload all # Send exit message then reload (for networked apps)

$ pm2 stop 0             # Stop specific process id
$ pm2 restart 0          # Restart specific process id

$ pm2 delete 0           # Will remove process from pm2 list
$ pm2 delete all         # Will remove all processes from pm2 list

# Misc

$ pm2 reset <process>    # Reset meta data (restarted time...)
$ pm2 updatePM2          # Update in memory pm2
$ pm2 ping               # Ensure pm2 daemon has been launched
$ pm2 sendSignal SIGUSR2 my-app # Send system signal to script
$ pm2 start app.js --no-daemon
```

## Different ways to launch a process

```bash
$ pm2 start app.js           # Start app.js

$ pm2 start app.js -- -a 23  # Pass arguments '-a 23' argument to app.js script

$ pm2 start app.js --name serverone # Start a process an name it as server one
                                    # you can now stop the process by doing
                                    # pm2 stop serverone

$ pm2 start app.js --node-args="--debug=7001" # --node-args to pass options to node V8

$ pm2 start app.js -i max    # Start maximum processes depending on available CPUs (cluster mode)

$ pm2 start app.js --log-date-format "YYYY-MM-DD HH:mm Z"    # Log will be prefixed with custom time format

$ pm2 start app.json                # Start processes with options declared in app.json
                                    # Go to chapter Multi process JSON declaration for more

$ pm2 start app.js -e err.log -o out.log  # Start and specify error and out log

$ pm2 --run-as-user foo start app.js  # Start app.js as user foo instead of the user that started pm2

$ pm2 --run-as-user foo --run-as-group bar start app.js  # Start app.js as foo:bar instead of the user:group that started pm2
```

For scripts in other languages:

```bash
$ pm2 start echo.pl --interpreter=perl

$ pm2 start echo.coffee
$ pm2 start echo.php
$ pm2 start echo.py
$ pm2 start echo.sh
$ pm2 start echo.rb
```

The interpreter is set by default with this equivalence:

```json
{
  ".sh": "bash",
  ".py": "python",
  ".rb": "ruby",
  ".coffee" : "coffee",
  ".php": "php",
  ".pl" : "perl",
  ".js" : "node"
}
```

<a name="a987"/>
## Options

```
Options:

    -h, --help                   output usage information
    -V, --version                output the version number
    -v --verbose                 verbose level
    -s --silent                  hide all messages
    -m --mini-list               display a compacted list without formatting
    -f --force                   force actions
    -n --name <name>             set a <name> for script
    -i --instances <number>      launch [number|'max'] (load balanced) instances (for networked app)
    -o --output <path>           specify out log file
    -e --error <path>            specify error log file
    -p --pid <pid>               specify pid file
    -x --execute-command         execute a program using fork system
    -u --user <username>         define user when generating startup script
    -c --cron <cron_pattern>     restart a running process based on a cron pattern
    -w --write                   write configuration in local folder
    --interpreter <interpreter>  the interpreter pm2 should use for executing app (bash, python...)
    --no-daemon                  run pm2 daemon in the foreground if it doesn't exist already
    --merge-logs                 merge logs
    --watch                      watch folder(s) for changes. When `true`, watching all folders from root. Can also be a string or an array of strings for paths to watch for changes.
    --node-args <node_args>      space-delimited arguments to pass to node in cluster mode - e.g. --node-args="--debug=7001 --trace-deprecation"
    --run-as-user <run_as_user>    The user or uid to run a managed process as
    --run-as-group <run_as_group>  The group or gid to run a managed process as
```

<a name="update-pm2"/>
## How to update PM2

Install the latest pm2 version :

```bash
$ npm install pm2@latest -g
```

Then update the in-memory PM2 :

```bash
$ pm2 updatePM2
```

# Features

<a name="a4"/>
## Transitional state of apps (important)

PM2 is a process manager. PM2 can start, stop, restart and *delete* processes.

Start a process:

```bash
$ pm2 start app.js --name "my-api"
$ pm2 start web.js --name "web-interface"
```

Now let's say I need to stop the web-interface:

```bash
$ pm2 stop web-interface
```

As you can see **the process hasn't disappeared**. It's still there but in `stopped` status.


To restart it just do:

```bash
$ pm2 restart web-interface
```

Now I want to **delete** the app from the PM2 process list.
To do so:

```bash
$ pm2 delete web-interface
```

<a name="a6"/>
## Process listing

![Monit](https://github.com/unitech/pm2/raw/master/pres/pm2-list.png)

To list all running processes:

```bash
$ pm2 list
# Or
$ pm2 [list|ls|l|status]
```

To get more details about a specific process:

```bash
$ pm2 describe 0
```

<a name="max-memory-restart"/>
## Automatic restart process based on memory

Value passed is in megaoctets. Internally it uses the V8 flag `--max-old-space-size=MEM` to make a process exit when memory exceed a certain amount of RAM used.

CLI:
```bash
$ pm2 start big-array.js --max-memory-restart 20
```

JSON:
```json
{
  "name" : "max_mem",
  "script" : "big-array.js",
  "max_memory_restart" : "20"
}
```

<a name="a7"/>
## Monitoring CPU/Memory usage

![Monit](https://github.com/unitech/pm2/raw/master/pres/pm2-monit.png)

Monitor all processes launched:

```bash
$ pm2 monit
```

<a name="a9"/>
## Logs management

### Displaying logs in realtime

![Monit](https://github.com/unitech/pm2/raw/master/pres/pm2-logs.png)

Displaying logs of specified process or all processes in realtime:

```bash
$ pm2 logs
$ pm2 logs big-api
$ pm2 flush # Clear all the logs
```

### Advanced log interface

Navigate between processes logs in realtime with an ergonomic interface:

```bash
$ pm2 ilogs
```

### Reloading all logs (SIGUSR2/Logrotate)

To reload all logs, you can send `SIGUSR2` to the PM2 process.

You can also reload all logs via the command line with:

```bash
$ pm2 reloadLogs
```

### Options

```bash
--merge-logs : merge logs from different instances but keep error and out separated
--log-date-format <format>: prefix logs with formated timestamp (http://momentjs.com/docs/#/parsing/string-format/)
```

<a name="a5"/>
## Clustering (cluster_mode)

The *cluster_mode* will automatically wrap your Node.js app into the cluster module and will enable you to reload your app without downtime and to scale your processes across all CPUs available.

To enable the *cluster_mode*, just pass the -i <instances> option:

```bash
$ pm2 start app.js -i 1
```

To launch `max` instances (`max` depending on the number of CPUs available) and set the load balancer to balance queries among process:

```bash
$ pm2 start app.js --name "API" -i max
```

If your app is well-designed (**stateless**) you'll be able to **process many more queries**.

Important concepts to make a Node.js app stateless:

- Sessions must not be stored in memory but shared via a database (Redis, Mongo, whatever)
- [WebSocket/Socket.io should communicate via a database](http://socket.io/docs/using-multiple-nodes/#passing-events-between-nodes)

<a name="a690"/>
## Reloading without downtime

As opposed to `restart`, which kills and restarts the process, `reload` achieves a 0-second-downtime reload.

**Warning** This feature only works for apps in *cluster_mode*, that uses HTTP/HTTPS/Socket connections.

To reload an app:

```bash
$ pm2 reload api
```

If the reload system hasn't managed to reload your app, a timeout will simply kill the process and will restart it.

### Graceful reload

Sometimes you can experience a **very long reload, or a reload that doesn't work** (fallback to restart).

It means that your app **still has open connections on exit**.

To work around this problem you have to use the graceful reload.
Graceful reload is a mechanism that will send a **shutdown** message to your process before reloading it.
You can control the time that the app has to shutdown via the `PM2_GRACEFUL_TIMEOUT` environment variable.

Example:

```javascript
process.on('message', function(msg) {
  if (msg == 'shutdown') {
    // Your process is going to be reloaded
    // You have to close all database/socket.io/* connections

    console.log('Closing all connections...');

    // You will have 4000ms to close all connections before
    // the reload mechanism will try to do its job

    setTimeout(function() {
      console.log('Finished closing connections');
      // This timeout means that all connections have been closed
      // Now we can exit to let the reload mechanism do its job
      process.exit(0);
    }, 1500);
  }
});
```

Then use the command:

```bash
$ pm2 gracefulReload [all|name]
```

When PM2 starts a new process to replace an old one, it will wait for the new process to begin listening to a connection before sending the shutdown message to the old one.  If a script does not need to listen to a connection, it can manually tell PM2 that the process has started up by calling `process.send('online')`.

<a name="a8"/>
## Startup script

PM2 has the amazing ability to **generate startup scripts and configure them**.
PM2 is also smart enough to **save all your process list** and to **bring back all your processes on restart**.

```bash
$ pm2 startup [ubuntu|centos|gentoo|systemd]
```

Once you have started the apps and want to keep them on server reboot do:

```bash
$ pm2 save
```

**Warning** It's tricky to make this feature work generically, so once PM2 has setup your startup script, reboot your server to make sure that PM2 has launched your apps!

### More information

Three types of startup scripts are available:

- SystemV init script (with the option `ubuntu` or `centos`)
- OpenRC init script (with the option `gentoo`)
- SystemD init script (with the `systemd` option)

The startup options are using:

- **ubuntu** will use `updaterc.d` and the script `lib/scripts/pm2-init.sh`
- **centos** will use `chkconfig` and the script `lib/scripts/pm2-init-centos.sh`
- **gentoo** will use `rc-update` and the script `lib/scripts/pm2`
- **systemd** will use `systemctl` and the script `lib/scripts/pm2.service`

### User permissions

Let's say you want the startup script to be executed under another user.

Just use the `-u <username>` option !

```bash
$ pm2 startup ubuntu -u www
```

### Related commands

Dump all processes status and environment managed by PM2:
```bash
$ pm2 dump
```
It populates the file `~/.pm2/dump.pm2` by default.

To bring back the latest dump:
```bash
$ pm2 [resurrect|save]
```

<a name="a890"/>
## Watch & Restart

PM2 can automatically restart your app when a file changes in the current directory or its subdirectories:

```bash
$ pm2 start app.js --watch
```

If `--watch` is enabled, stopping it won't stop watching:
- `pm2 stop 0` 'll not stop watching
- `pm2 stop --watch 0` 'll stop watching

Restart toggle the `watch` parameter when triggered.

To watch specifics paths, please use a JSON app declaration, `watch` can take a string or an array of paths. Default is `true`:

```json
{
  "watch": ["server", "client"],
  "ignoreWatch" : ["node_modules", "client/img"]
}
```

<a name="a10"/>
## JSON app declaration

You can define parameters for your apps in `processes.json`:

```json
{
  "apps" : [{
    "name"        : "echo",
    "script"      : "examples/args.js",
    "args"        : "['--toto=heya coco', '-d', '1']",
    "log_date_format"  : "YYYY-MM-DD HH:mm Z",
    "ignoreWatch" : ["[\\/\\\\]\\./", "node_modules"],
    "watch"       : true,
    "node_args"   : "--harmony",
    "cwd"         : "/this/is/a/path/to/start/script",
    "env": {
        "NODE_ENV": "production",
        "AWESOME_SERVICE_API_TOKEN": "xxx"
    }
  },{
    "name"       : "api",
    "script"     : "./examples/child.js",
    "instances"  : "4",
    "log_date_format"  : "YYYY-MM-DD",
    "error_file" : "./examples/child-err.log",
    "out_file"   : "./examples/child-out.log",
    "pid_file"   : "./examples/child.pid",
    "exec_mode"  : "cluster_mode",
    "port"       : 9005
  },{
    "name"       : "auto-kill",
    "script"     : "./examples/killfast.js",
    "min_uptime" : "100",
    "exec_mode"  : "fork_mode"
  }]
}
```

Then run:
```bash
$ pm2 start processes.json
$ pm2 stop processes.json
$ pm2 delete processes.json
$ pm2 restart processes.json
```

**A few notes about JSON app declarations:**

- All command line options passed when using the JSON app declaration will be dropped i.e.

```bash
$ cat node-app-1.json

{
  "name" : "node-app-1",
  "script" : "app.js",
  "cwd" : "/srv/node-app-1/current"
}

$ pm2 --run-as-user app start node-app-1.json

$ ps aux | grep node-app
root 14735 5.8 1.1 752476 83932 ? Sl 00:08 0:00 pm2: node-app-1  <-- owned by the default user (root), not app
```
- JSON app declarations are additive.  Continuing from above:
```bash
$ pm2 start node-app-2.json
$ ps aux | grep node-app
root  14735  5.8  1.1  752476  83932 ? Sl 00:08 0:00 pm2: node-app-1
root  24271  0.0  0.3  696428  24208 ? Sl 17:36 0:00 pm2: node-app-2
```
Note that if you execute `pm2 start node-app-2` again, it will spawn an additional instance node-app-2.

- **cwd:** your JSON declaration does not need to reside with your script.  If you wish to maintain the JSON(s) in a location other than your script (say, `/etc/pm2/conf.d/node-app.json`) you will need to use the cwd feature.  (Note, this is especially helpful for capistrano style directory structures that use symlinks.)  Files can be either relative to the cwd directory, or absolute (example below.)

- The following are valid options for JSON app declarations:
```
[{
  "name"             : "node-app",
  "cwd"              : "/srv/node-app/current",
  "args"             : "['--toto=heya coco', '-d', '1']",
  "script"           : "bin/app.js",
  "node_args"        : "--harmony",
  "log_date_format"  : "YYYY-MM-DD HH:mm Z",
  "error_file"       : "/var/log/node-app/node-app.stderr.log",
  "out_file"         : "log/node-app.stdout.log",
  "pid_file"         : "pids/node-geo-api.pid",
  "run_as_user"      : "app",
  "run_as_group"     : "www-data",
  "instances"        : "6", //or 'max'
  "min_uptime"       : "200", // milliseconds, defaults to 1000
  "max_restarts"     : "10", // defaults to 15
  "cron_restart"     : "1 0 * * *",
  "watch"            : false,
  "ignoreWatch"      : ["[\\/\\\\]\\./", "node_modules"],
  "merge_logs"       : true,
  "exec_interpreter" : "node",
  "exec_mode"        : "fork_mode",
  "env": {
    "NODE_ENV": "production",
    "AWESOME_SERVICE_API_TOKEN": "xxx"
  }
}]
```

<a name="deployment"/>
# Deployment (PM2 >= 0.9.0)

PM2 embed a simple and powerful deployment system with revision tracing.
It's based on <a href="https://github.com/visionmedia/deploy">https://github.com/visionmedia/deploy</a>

A step-by-step tutorial is available here : [Deploy and Iterate faster with PM2 deploy](https://keymetrics.io/2014/06/25/ecosystem-json-deploy-and-iterate-faster/)

## Getting started with deployment

Please read the [Considerations to use PM2 deploy](#considerations)

1- Generate a sample ecosystem.json file that list processes and deployment environment

```bash
$ pm2 ecosystem
```

In the current folder a `ecosystem.json` file will be created.
It contains this:

```json
{
  "apps" : [{
    "name"      : "API",
    "script"    : "app.js",
    "env": {
      "COMMON_VARIABLE": "true"
    },
    "env_production" : {
      "NODE_ENV": "production"
    }
  },{
    "name"      : "WEB",
    "script"    : "web.js"
  }],
  "deploy" : {
    "production" : {
      "user" : "node",
      "host" : "212.83.163.1",
      "ref"  : "origin/master",
      "repo" : "git@github.com:repo.git",
      "path" : "/var/www/production",
      "post-deploy" : "pm2 startOrRestart ecosystem.json --env production"
    },
    "dev" : {
      "user" : "node",
      "host" : "212.83.163.1",
      "ref"  : "origin/master",
      "repo" : "git@github.com:repo.git",
      "path" : "/var/www/development",
      "post-deploy" : "pm2 startOrRestart ecosystem.json --env dev"
    }
  }
}
```

Edit the file according to your needs.

2- Be sure that you have the public ssh key on your local machine

```bash
$ ssh-keygen -t rsa
$ ssh-copy-id root@myserver.com
```

3- Now initialize the remote folder with:

```bash
$ pm2 deploy <configuration_file> <environment> setup
```

E.g:

```bash
$ pm2 deploy ecosystem.json production setup
```

This command will create all the folders on your remote server.

4- Deploy your code

```bash
$ pm2 deploy ecosystem.json production
```

Now your code will be populated, installed and started with PM2

<a name="deployment-help"/>
## Deployment options

Display deploy help via `pm2 deploy help`:

```
$ pm2 deploy <configuration_file> <environment> <command>

  Commands:
    setup                run remote setup commands
    update               update deploy to the latest release
    revert [n]           revert to [n]th last deployment or 1
    curr[ent]            output current release commit
    prev[ious]           output previous release commit
    exec|run <cmd>       execute the given <cmd>
    list                 list previous deploy commits
    [ref]                deploy to [ref], the "ref" setting, or latest tag
```

## Commands

```
$ pm2 startOrRestart all.json            # Invoke restart on all apps in JSON
$ pm2 startOrReload all.json             # Invoke reload
$ pm2 startOrGracefulReload all.json     # Invoke gracefulReload
```

<a name="considerations"/>
## Considerations

- You might want to commit your node_modules folder ([#622](https://github.com/Unitech/pm2/issues/622)) or add the `npm install` command to the `post-deploy` section: `"post-deploy" : "npm install && pm2 startOrRestart ecosystem.json --env production"`
- Verify that your remote server has the permission to git clone the repository
- You can declare specific environment variable depending on the environment you want to deploy the code to. For instance to declare variables for the production environment, just add "env_production": {} and declare that variables.
- PM2 will look by default to `ecosystem.json`. So you can skip the <configuration_file> options if it's the case
- You can embed the "apps" & "deploy" section in the package.json
- It deploys your code via ssh, you don't need any dependencies
- Process are initialized / started automatically depending on application name in `ecosystem.json`
- PM2-deploy repository is there: [pm2-deploy](https://github.com/Unitech/pm2-deploy)

<a name="deployment-contribution"/>
## Contributing

The module is <a href="https://github.com/Unitech/pm2-deploy">https://github.com/Unitech/pm2-deploy</a>
Feel free to PR for any changes or fix.

<a name="programmatic-example"/>
# Using PM2 programmatically

PM2 can be used programmatically, meaning that you can embed a process manager directly in your code, spawn processes, keep them alive even if the main script is exited.

Check out [this article](http://keymetrics.io/2014/07/02/manage-processes-programmatically-with-pm2/) for more informations.

## Simple example

This will require pm2, launch `test.js`, list processes then exit the script.
You will notice that after exiting this script you will be able to see `test.js` process with `pm2 list`

```bash
$ npm install pm2 --save
```

```javascript
var pm2 = require('pm2');

// Connect or launch PM2
pm2.connect(function(err) {

  // Start a script on the current folder
  pm2.start('test.js', { name: 'test' }, function(err, proc) {
    if (err) throw new Error('err');

    // Get all processes running
    pm2.list(function(err, process_list) {
      console.log(process_list);

      // Disconnect to PM2
      pm2.disconnect(function() { process.exit(0) });
    });
  });
})
```

<a name="programmatic-api"/>
## Programmatic API

<table class="table table-striped table-bordered">
    <tr>
        <th>Method name</th>
        <th>API</th>
    </tr>
     <tr>
      <td><b>Connect/Launch</b></td>
      <td>pm2.connect(fn(err){})</td>
    </tr>
     <tr>
      <td><b>Disconnect</b></td>
      <td>pm2.disconnect(fn(err, proc){})</td>
    </tr>
</table>

**Consideration with .connect**: the .connect method connect to the local PM2, but if PM2 is not up, it will launch it and will put in in background as you launched it via CLI.

<table class="table table-striped table-bordered">
    <tr>
        <th>Method name</th>
        <th>API</th>
    </tr>
    <tr>
      <td><b>Start</b></td>
      <td>pm2.start(script_path|json_path, options, fn(err, proc){})</td>
    </tr>
    <tr>
      <td>Options </td>
      <td>
      nodeArgs(arr), scriptArgs(arr), name(str), instances(int), error(str), output(str), pid(int), cron(str), mergeLogs(bool), watch(bool), runAsUser(int), runAsGroup(int), executeCommand(bool), interpreter(str), write(bool)</td>
    </tr>
    <tr>
      <td><b>Restart</b></td>
      <td>pm2.restart(proc_name|proc_id|all, fn(err, proc){})</td>
       </tr>
     <tr>
      <td><b>Stop</b></td>
      <td>pm2.stop(proc_name|proc_id|all, fn(err, proc){})</td>
    </tr>
    <tr>
      <td><b>Delete</b></td>
      <td>pm2.delete(proc_name|proc_id|all, fn(err, proc){})</td>
    </tr>


    <tr>
      <td><b>Reload</b></td>
      <td>pm2.reload(proc_name|all, fn(err, proc){})</td>
    </tr>
      <tr>
      <td><b>Graceful Reload</b></td>
      <td>pm2.gracefulReload(proc_name|all, fn(err, proc){})</td>
    </tr>
</table>

<table class="table table-striped table-bordered">
    <tr>
        <th>Method name</th>
        <th>API</th>
    </tr>
    <tr>
      <td><b>List</b></td>
      <td>pm2.list(fn(err, list){})</td>
    </tr>
    <tr>
      <td><b>Describe process</b></td>
      <td>pm2.describe(proc_name|proc_id, fn(err, list){})</td>
    </tr>
    <tr>
      <td><b>Dump (save)</b></td>
      <td>pm2.dump(fn(err, ret){})</td>
    </tr>
    <tr>
      <td><b>Flush logs</b></td>
      <td>pm2.flush(fn(err, ret){})</td>
    </tr>
     <tr>
      <td><b>Reload logs</b></td>
      <td>pm2.reloadLogs(fn(err, ret){})</td>
    </tr>
         <tr>
      <td><b>Send signal</b></td>
      <td>pm2.sendSignalToProcessName(signal,proc,fn(err, ret){})</td>
    </tr>
     <tr>
      <td><b>Generate start script</b></td>
      <td>pm2.startup(platform, fn(err, ret){})</td>
    </tr>
     <tr>
      <td><b>Kill PM2</b></td>
      <td>pm2.killDaemon(fn(err, ret){})</td>
    </tr>
</table>

<a name="a77"/>
# Special features

Launching PM2 without daemonizing itself:

```bash
$ pm2 start app.js --no-daemon
```

Sending a system signal to a process:

```bash
$ pm2 sendSignal SIGUSR2 my-app
```

<a name="a989"/>
## Configuration file

You can specify the following options by editing the file `~/.pm2/custom_options.sh`:

```
PM2_RPC_PORT
PM2_PUB_PORT
PM2_BIND_ADDR
PM2_API_PORT
PM2_GRACEFUL_TIMEOUT
PM2_MODIFY_REQUIRE
```

## API health endpoint

```bash
$ pm2 web
```

<a name="a66"/>
## Enabling Harmony ES6

The `--node-args` option permit to launch script with V8 flags, so to enable harmony for a process just do this:
```bash
$ pm2 start my_app.js --node-args="--harmony"
```

And with JSON declaration:

```bash
[{
  "name" : "ES6",
  "script" : "es6.js",
  "node_args" : "--harmony"
}]
```

<a name="a19"/>
## CoffeeScript

```bash
$ pm2 start my_app.coffee
```

That's all!

# Knowledge


<a name="stateless-apps"/>
## Stateless apps

We recommend (and you must) write stateless NodeJS apps. Apps that don't retain any form of local variables or local instances or whatever local.
Every data, states, websocket session, session data, must be shared via any kind of database.

We recommend using Redis for sharing session data, websocket.

- SocketIO with Redis : [https://github.com/LearnBoost/Socket.IO/wiki/Configuring-Socket.IO](Configuring SocketIO)
- Redis session store for Connect : [https://github.com/visionmedia/connect-redis](Connect-redis)

We recommend following the 12 factor convention : [http://12factor.net/](http://12factor.net/)

<a name="a89"/>
## Setup pm2 on a server

[How To Use pm2 to Setup a Node.js Production Environment On An Ubuntu VPS](https://www.digitalocean.com/community/articles/how-to-use-pm2-to-setup-a-node-js-production-environment-on-an-ubuntu-vps)

<a name="a34"/>
## Log and PID files

By default, logs (error and output), pid files, dumps, and PM2 logs are located in `~/.pm2/`:

```
.pm2/
├── dump.pm2
├── custom_options.sh
├── pm2.log
├── pm2.pid
├── logs
└── pids
```

<a name="a23"/>
## Execute any kind of script

In fork mode almost all options are the same as the cluster mode. But there is no [`reload`](#reloading-without-downtime) or `gracefulReload` command.

You can also exec scripts written in other languages:

```bash
$ pm2 start my-bash-script.sh -x --interpreter bash

$ pm2 start my-python-script.py -x --interpreter python
```

The interpreter is deduced from the file extension from the [following list](https://github.com/Unitech/pm2/blob/master/lib/interpreter.json).

<a name="a96"/>
## JSON app configuration via pipe from stdout

Pull-requests:
- [#273](https://github.com/Unitech/pm2/pull/273)
- [#279](https://github.com/Unitech/pm2/pull/279)

```bash
#!/bin/bash

read -d '' my_json <<_EOF_
[{
    "name"       : "app1",
    "script"     : "/home/projects/pm2_nodetest/app.js",
    "instances"  : "4",
    "error_file" : "./logz/child-err.log",
    "out_file"   : "./logz/child-out.log",
    "pid_file"   : "./logz/child.pid",
    "exec_mode"  : "cluster_mode",
    "port"       : 4200
}]
_EOF_

echo $my_json | pm2 start -
```

<a name="a149"/>
## Is my production server ready for PM2?

Just try the tests before using PM2 on your production server

```bash
$ git clone https://github.com/Unitech/pm2.git
$ cd pm2
$ npm install  # Or do NODE_ENV=development npm install if some packages are missing
$ npm test
```

If a test is broken please report us issues [here](https://github.com/Unitech/pm2/issues?state=open)
Also make sure you have all dependencies needed. For Ubuntu:

```bash
$ sudo apt-get install build-essential
# nvm is a Node.js version manager - https://github.com/creationix/nvm
$ wget -qO- https://raw.github.com/creationix/nvm/master/install.sh | sh
$ nvm install v0.11.14
$ nvm use v0.11.14
$ nvm alias default v0.11.14
```

<a name="a27"/>
## Contributing/Development mode

To hack PM2, it's very simple:

```bash
$ pm2 kill   # kill the current pm2
$ git clone my_pm2_fork.git
$ cd pm2/
$ DEBUG=* PM2_DEBUG=true ./bin/pm2 --no-daemon
```

Each time you edit the code, be sure to kill and restart PM2 to make changes taking effect.

## Install PM2 development

```bash
$ npm install git://github.com/Unitech/pm2#development -g
```

<a name="a21"/>
## Known bugs and workarounds

First, install the lastest PM2 version:

```bash
$ npm install -g pm2@latest
```

### Node 0.10.x doesn't free the script port when stopped in cluster_mode

Don't use the *cluster_mode* via -i option.

### User tips from issues
- [Vagrant and pm2 #289](https://github.com/Unitech/pm2/issues/289#issuecomment-42900019)
- [Start the same app on different ports #322](https://github.com/Unitech/pm2/issues/322#issuecomment-46792733)
- [Using ansible with pm2](https://github.com/Unitech/pm2/issues/88#issuecomment-49106686)
- [Cron string as argument](https://github.com/Unitech/pm2/issues/496#issuecomment-49323861)
- [Restart when process reaches a specific memory amount](https://github.com/Unitech/pm2/issues/141)
- [Sticky sessions and socket.io discussion](https://github.com/Unitech/PM2/issues/637)

<a name="a20"/>
## External resources and articles

- [Goodbye node-forever, hello pm2](http://devo.ps/blog/2013/06/26/goodbye-node-forever-hello-pm2.html)
- http://www.allaboutghost.com/keep-ghost-running-with-pm2/
- http://blog.ponyfoo.com/2013/09/19/deploying-node-apps-to-aws-using-grunt
- http://www.allaboutghost.com/keep-ghost-running-with-pm2/
- http://bioselemental.com/keeping-ghost-alive-with-pm2/
- http://blog.chyld.net/installing-ghost-on-ubuntu-13-10-aws-ec2-instance-with-pm2/
- http://blog.marvinroger.fr/gerer-ses-applications-node-en-production-pm2/
- https://www.codersgrid.com/2013/06/29/pm2-process-manager-for-node-js/
- http://www.z-car.com/blog/programming/how-to-rotate-logs-using-pm2-process-manager-for-node-js
- http://yosoftware.com/blog/7-tips-for-a-node-js/
- https://www.exponential.io/blog/nodeday-2014-moving-a-large-developer-workforce-to-nodejs
- http://blog.rapsli.ch/posts/2013/2013-10-17-node-monitor-pm2.html
- https://coderwall.com/p/igdqyw
- http://revdancatt.com/2013/09/17/node-day-1-getting-the-server-installing-node-and-pm2/
- https://medium.com/tech-talk/e7c0b0e5ce3c

## Contributors

[Contributors](https://github.com/Unitech/PM2/graphs/contributors)

## Sponsors

Thanks to [Devo.ps](http://devo.ps/) and [Wiredcraft](http://wiredcraft.com/) for their knowledge and expertise.

<a name="a15"/>
# License

Files in `lib/` are made available under the terms of the GNU Affero General Public License 3.0 (AGPL 3.0).
Except the file `lib/CLI.js` who is made under the terms of the Apache V2 license.
