# PM2 production process manager

## Table of contents

### Quick start

- [Installation](#a1)
- [Usage](#a2)
- [Examples](#a3)
- [Different ways to launch a process](#raw-examples)
- [Options](#a987)
  - [Schema](#schema)
- [How to update PM2?](#update-pm2)

### Features

- [Transitional state of apps](#a4)
- [Process listing](#a6)
- [Automatic restart process based on memory](#max-memory-restart)
- [Monitoring CPU/Memory usage](#a7)
- [Logs management](#a9)
- [Clustering](#a5)
- [Watch & Restart](#watch--restart)
- [Reloading without downtime](#hot-reload--0s-reload)
- [Make PM2 restart on server reboot](#a8)
- [JSON app declaration](#json-app-declaration)
  - [Options list](#list-of-all-json-declaration-fields-avaibles)
  - [Schema](#schema)

### Windows specifics

- [Windows](#windows)

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
$ pm2 start app.js -i 0        # Will start maximum processes with LB depending on available CPUs
$ pm2 start app.js -i max      # Same as above, but deprecated yet.

# Listing

$ pm2 list               # Display all processes status
$ pm2 jlist              # Print process list in raw JSON
$ pm2 prettylist         # Print process list in beautified JSON

$ pm2 describe 0         # Display all informations about a specific process

$ pm2 monit              # Monitor all processes

# Logs

$ pm2 logs [--raw]       # Display all processes logs in streaming
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
$ pm2 start app.js --no-vizion
$ pm2 start app.js --no-autorestart
```

## Different ways to launch a process

```bash
$ pm2 start app.js           # Start app.js

$ pm2 start app.js -- -a 23  # Pass arguments '-a 23' argument to app.js script

$ pm2 start app.js --name serverone # Start a process an name it as server one
                                    # you can now stop the process by doing
                                    # pm2 stop serverone

$ pm2 start app.js --node-args="--debug=7001" # --node-args to pass options to node V8

$ pm2 start app.js -i 0             # Start maximum processes depending on available CPUs (cluster mode)

$ pm2 start app.js --log-date-format "YYYY-MM-DD HH:mm Z"    # Log will be prefixed with custom time format

$ pm2 start app.json                # Start processes with options declared in app.json
                                    # Go to chapter Multi process JSON declaration for more

$ pm2 start app.js -e err.log -o out.log  # Start and specify error and out log

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

   -h, --help                           output usage information
   -V, --version                        output the version number
   -v --version                         get version
   -s --silent                          hide all messages
   -m --mini-list                       display a compacted list without formatting
   -f --force                           force actions
   -n --name <name>                     set a <name> for script
   -i --instances <number>              launch [number] instances (for networked app)(load balanced)
   -l --log [path]                      specify entire log file (error and out are both included)
   -o --output <path>                   specify out log file
   -e --error <path>                    specify error log file
   -p --pid <pid>                       specify pid file
   --max-memory-restart <memory>        specify max memory amount used to autorestart (in megaoctets)
   --env <environment_name>             specify environment to get specific env variables (for JSON declaration)
   -x --execute-command                 execute a program using fork system
   -u --user <username>                 define user when generating startup script
   -c --cron <cron_pattern>             restart a running process based on a cron pattern
   -w --write                           write configuration in local folder
   --interpreter <interpreter>          the interpreter pm2 should use for executing app (bash, python...)
   --log-date-format <momentjs format>  add custom prefix timestamp to logs
   --no-daemon                          run pm2 daemon in the foreground if it doesn't exist already
   --merge-logs                         merge logs from different instances but keep error and out separated
   --watch                              watch application folder for changes
   --ignore-watch <folders|files>       folder/files to be ignored watching, chould be a specific name or regex - e.g. --ignore-watch="test node_modules "some scripts""
   --node-args <node_args>              space delimited arguments to pass to node in cluster mode - e.g. --node-args="--debug=7001 --trace-deprecation"
   --no-color                           skip colors
   --no-vizion                          skip vizion features (versioning control)
   --no-autorestart                     do not automatically restart apps
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
## Managing applications states

PM2 is a process manager.
It manages your applications states, so you can start, stop, restart and *delete* processes.

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

To list all running processes:

```bash
$ pm2 list
# Or
$ pm2 [list|ls|l|status]
```

To get more details about a specific process:

```bash
$ pm2 show 0
```

<a name="a7"/>
## Monitoring CPU/Memory

PM2 gives you a simple way to monitor the resource usage of your application.
You can monitor memory and cpu very easily, straight from your terminal:

```bash
$ pm2 monit
```

Please note that [Keymetrics](https://keymetrics.io) allows to monitor applications much better, from errors, performances, vital signs and much more.

<a name="a5"/>
## Clustering (cluster_mode)

The **cluster mode** allows to scale your Node.js application accross all CPUs available and to update them without any downtime!

It's perfectly fitted for networked applications handling HTTP(s)/UDP/TCP connections.

To enable the **cluster mode**, just pass the -i <instances> option:

```bash
$ pm2 start app.js -i 1
```

You can pass multiple values to the instances (-i) option:

```
# Start the maximum processes depending on available CPUs
$ pm2 start app.js -i 0

# Start the maximum processes -1 depending on available CPUs
$ pm2 start app.js -i -1

# Start 3 processes
$ pm2 start app.js -i 3
```

### Considerations

- You don't need to modify anything from you code to be able to use this nifty feature.
- In your application the environment variable `NODE_APP_INSTANCE` is exposed so you can listen for different port if needed. (e.g .listen(8000 + process.env.NODE_APP_INSTANCE))
- Be sure your **application is stateless** meaning that there is not any local data stored in the process, like sessions/websocket connections etc. Use Redis, Mongo or other DB to share states between processes

### Hot reload / 0s reload

As opposed to `restart`, which kills and restarts the process, `reload` achieves a 0-second-downtime reload.

**Warning** This feature only works for apps in **cluster mode**, that uses HTTP/HTTPS/Socket connections.

To reload an app:

```bash
$ pm2 reload api
```

If the reload system hasn't managed to reload your app, a timeout will fallback to a classic restart.

### Graceful reload

Sometimes you can experience a **very long reload, or a reload that doesn't work** (fallback to restart) meaning that your app still has open connections on exit.
Or you may need to close all databases connections, clear a data queue or whatever.

To work around this problem you have to **use the graceful reload**.

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

When PM2 starts a new process to replace an old one, it will wait for the new process to begin listening to a connection or a timeout before sending the shutdown message to the old one. You can define the timeout value with the `PM2_GRACEFUL_LISTEN_TIMEOUT` environament variable. If a script does not need to listen to a connection, it can manually tell PM2 that the process has started up by calling `process.send('online')`.

<a name="a9"/>
## Logs management


PM2 allows you to manage logs easily. You can display all application logs in real-time, flush them, and reload them.
There are also different ways to configure how PM2 will handle your logs (separated in different files, merged, with timestamp...) without modifying anything in your code.

### Displaying logs in real-time

Displaying logs of a specified process or of all processes in real-time:

```bash
$ pm2 logs
$ pm2 logs big-api
```

### Flushing logs

```bash
$ pm2 flush # Clear all the logs
```

You can configure a Cron Job to call this command every X days.
Or you can install Log rotate to handle the log rotation.

### Reloading all logs

Reloading logs is specially usefull for Logrotate or any other rotating log system.

You can reload logs by sending `SIGUSR2` to the PM2 process.

You can also reload all logs via the command line with:

```bash
$ pm2 reloadLogs
```

### Configuring logs

#### CLI

```bash
$ pm2 start echo.js --merge-logs --log-date-format="YYYY-MM-DD HH:mm Z"
```

Options:

```bash
--merge-logs                 do not postfix log file with process id
--log-date-format <format>   prefix logs with formated timestamp
-l --log [path]              specify entire log file (error and out are both included)
-o --output <path>           specify out log file
-e --error <path>            specify error log file
```

### JSON / Programmatic

```
{
  "script"          : "echo.js",
  "error_file"        : "err.log",
  "out_file"        : "out.log",
  "merge_logs"      : true,
  "log_date_format" : "YYYY-MM-DD HH:mm Z"
}
```

**Note**: To merge all logs into the same file set the same value for `error_file`, `out_file`.

<a name="max-memory-restart"/>
## Max Memory Restart

PM2 allows to restart an application based on a memory limit.

### CLI

```bash
$ pm2 start big-array.js --max-memory-restart 20M
```

### JSON

```json
{
  "name"   : "max_mem",
  "script" : "big-array.js",
  "max_memory_restart" : "20M"
}
```

### Programmatic

```
pm2.start({{
  name               : "max_mem",
  script             : "big-array.js",
  max_memory_restart : "20M"
}, function(err, proc) {
  // Processing
});
```

### Units

Units can be K(ilobyte), M(egabyte), G(igabyte).

```
50M
50K
1G
```

<a name="a8"/>
## Startup script

PM2 can **generate startup scripts and configure them**.
PM2 is also smart enough to **save all your process list** and to **bring back all your processes at machine restart**.

```bash
$ pm2 startup
# auto-detect platform
$ pm2 startup [platform]
# render startup-script for a specific platform, the [platform] could be one of:
#   ubuntu|centos|redhat|gentoo|systemd|darwin|amazon
```

Once you have started the apps and want to keep them on server reboot do:

```bash
$ pm2 save
```

**Warning** It's tricky to make this feature work generically, so once PM2 has setup your startup script, reboot your server to make sure that PM2 has launched your apps!

### Startup Systems support

Three types of startup scripts are available:

- SystemV init script (with the option `ubuntu` or `centos`)
- OpenRC init script (with the option `gentoo`)
- SystemD init script (with the `systemd` option)

The startup options are using:

- **ubuntu** will use `updaterc.d` and the script `lib/scripts/pm2-init.sh`
- **centos**/**redhat** will use `chkconfig` and the script `lib/scripts/pm2-init-centos.sh`
- **gentoo** will use `rc-update` and the script `lib/scripts/pm2`
- **systemd** will use `systemctl` and the script `lib/scripts/pm2.service`
- **darwin** will use `launchd` to load a specific `plist` to resurrect processes after reboot.

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

## Watch & Restart

PM2 can automatically restart your app when a file changes in the current directory or its subdirectories:

```bash
$ pm2 start app.js --watch
```

If `--watch` is enabled, stopping it won't stop watching:
- `pm2 stop 0` will not stop watching
- `pm2 stop --watch 0` will stop watching

Restart toggle the `watch` parameter when triggered.

To watch specific paths, please use a JSON app declaration, `watch` can take a string or an array of paths. Default is `true`:

```json
{
  "watch": ["server", "client"],
  "ignore_watch" : ["node_modules", "client/img"],
  "watch_options": {
    "followSymlinks": false
  }
}
```

As specified in the [Schema](#a988):
- `watch` can be a boolean, an array of paths or a string representing a path. Default to `false`
- `ignore_watch` can be an array of paths or a string, it'll be interpreted by [chokidar](https://github.com/paulmillr/chokidar#path-filtering) as a glob or a regular expression.
- `watch_options` is an object that will replace options given to chokidar. Please refer to [chokidar documentation](https://github.com/paulmillr/chokidar#api) for the definition.

PM2 is giving chokidar these Default options:

```
var watch_options = {
  persistent    : true,
  ignoreInitial : true
}
```

## JSON app declaration


PM2 empowers your process management workflow, by allowing you to fine-tune the behavior, options, environment variables, logs files... of each process you need to manage via JSON configuration.

It's particularly usefull for micro service based applications.

You can define parameters for your apps in a JSON file:

```json
{
  "apps" : [{
    "name"        : "worker-app",
    "script"      : "worker.js",
    "args"        : ["--toto=heya coco", "-d", "1"],
    "watch"       : true,
    "node_args"   : "--harmony",
    "merge_logs"  : true,
    "cwd"         : "/this/is/a/path/to/start/script",
    "env": {
        "NODE_ENV": "production",
        "AWESOME_SERVICE_API_TOKEN": "xxx"
    }
  },{
    "name"       : "api-app",
    "script"     : "api.js",
    "instances"  : 4,
    "exec_mode"  : "cluster_mode",
    "error_file" : "./examples/child-err.log",
    "out_file"   : "./examples/child-out.log",
    "pid_file"   : "./examples/child.pid"
  }]
}
```

Then you can run:

```bash
# Start all apps
$ pm2 start processes.json

# Stop
$ pm2 stop processes.json

# Delete from PM2
$ pm2 delete processes.json

# Restart all
$ pm2 restart processes.json
```

### Options

The following are valid options for JSON app declarations:

```json
{
  "name"             : "node-app",
  "cwd"              : "/srv/node-app/current",
  "args"             : ["--toto=heya coco", "-d", "1"],
  "script"           : "bin/app.js",
  "node_args"        : ["--harmony", " --max-stack-size=102400000"],
  "log_date_format"  : "YYYY-MM-DD HH:mm Z",
  "error_file"       : "/var/log/node-app/node-app.stderr.log",
  "out_file"         : "log/node-app.stdout.log",
  "pid_file"         : "pids/node-geo-api.pid",
  "instances"        : 6, //or 0 => 'max'
  "min_uptime"       : "200s", // 200 seconds, defaults to 1000
  "max_restarts"     : 10, // defaults to 15
  "max_memory_restart": "1M", // 1 megabytes, e.g.: "2G", "10M", "100K", 1024 the default unit is byte.
  "cron_restart"     : "1 0 * * *",
  "watch"            : false,
  "ignore_watch"      : ["[\\/\\\\]\\./", "node_modules"],
  "merge_logs"       : true,
  "exec_interpreter" : "node",
  "exec_mode"        : "fork",
  "autorestart"      : false, // enable/disable automatic restart when an app crashes or exits
  "vizion"           : false, // enable/disable vizion features (versioning control)
  "env": {
    "NODE_ENV": "production",
    "AWESOME_SERVICE_API_TOKEN": "xxx"
  }
}
```

### List of all JSON-declaration fields avaibles

|        Field       |   Type  |                  Example                  |                                                                                          Description                                                                                         |
|:------------------:|:-------:|:-----------------------------------------:|:--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|
|        name        |  string |                  "myAPI"                  |                                                                                name your app will have in PM2                                                                                |
|       script       |  string |                "bin/app.js"               |                                                                                       path of your app                                                                                       |
|        args        |   list  |       ["--enable-logs", "-n", "15"]       |                                                                        arguments given to your app when it is launched                                                                       |
|      node_args     |   list  |   ["--harmony", "--max-stack-size=1024"]  |                                                                          arguments given to node when it is launched                                                                         |
|         cwd        |  string |            "/var/www/app/prod"            |                                                                      the directory from which your app will be launched                                                                      |
|      exec_mode     |  string |                 "cluster"                 |                                                    "fork" mode is used by default, "cluster" mode can be configured with `instances` field                                                   |
|      instances     |  number |                     4                     | number of instances for your clustered app, `0` means as much instances as you have CPU cores. a negative value means CPU cores - value (e.g -1 on a 4 cores machine will spawn 3 instances) |
|  exec_interpreter  |  string |                   "node"                  |                       defaults to "node". can be "python", "ruby", "bash" or whatever interpreter you wish to use. "none" will execute your app as a binary executable                       |
|   log_date_format  |  string |            "YYYY-MM-DD HH:mm Z"           |                                                                   format in which timestamps will be displayed in the logs                                                                   |
|     error_file     |  string |  "/var/log/node-app/node-app.stderr.log"  |                             path to the specified error log file. PM2 generates one by default if not specified and you can find it by typing `pm2 desc <app id>`                            |
|      out_file      |  string |  "/var/log/node-app/node-app.stdout.log"  |                            path to the specified output log file. PM2 generates one by default if not specified and you can find it by typing `pm2 desc <app id>`                            |
|      pid_file      |  string |          "pids/node-geo-api.pid"          |                                path to the specified pid file. PM2 generates one by default if not specified and you can find it by typing `pm2 desc <app id>`                               |
|     merge_logs     | boolean |                   false                   |                                                      defaults to false. if true, it will merge logs from all instances of the same app into the same file                                                     |
|    cron_restart    |  string |                "1 0 * * *"                |                                      a cron pattern to restart your app. only works in "cluster" mode for now. soon to be avaible in "fork" mode as well                                     |
|        watch       | boolean |                    true                   |                 enables the watch feature, defaults to "false". if true, it will restart your app everytime a file change is detected on the folder or subfolder of your app.                |
|    ignore_watch    |   list  |     ["[\\/\\\\]\\./", "node_modules"]     |                                                            list of regex to ignore some file or folder names by the watch feature                                                            |
|    max_restarts    |  number |                     10                    |                   number of consecutive unstable restarts (less than 1sec interval) before your app is considered errored and stop being restarted by PM2. defaults to 15.                   |
| max_memory_restart |  string |                   "150M"                  |                      your app will be restarted by PM2 if it exceeds the amount of memory specified. human-friendly format : it can be "10M", "100K", "2G" and so on...                      |
|         env        |  object |   {"NODE_ENV": "production", "ID": "42"}  |                                                                          env variables which will appear in your app                                                                         |
|     autorestart    | boolean |                   false                   |                                                   true by default. if false, PM2 will not restart your app if it crashes or ends peacefully                                                  |
|       vizion       | boolean |                   false                   |                                               true by default. if false, PM2 will start without vizion features (versioning control metadatas)                                               |
|     post_update    |   list  | ["npm install", "echo launching the app"] |                                        a list of commands which will be executed after you perform a Pull/Upgrade operation from Keymetrics dashboard                                        |
|        force       | boolean |                    true                   |                                          defaults to false. if true, you can start the same script several times which is usually not allowed by PM2                                          |
|     next_gen_js    | boolean |                    true                   |                             defaults to false. if true, PM2 will launch your app using embedded BabelJS features which means you can run ES6/ES7 javascript code                             |

### Schema

The completely definitions:

```JSON
{
  "script": {
    "type": "string",
    "require": true
  },
  "args": {
    "type": [
      "array",
      "string"
    ]
  },
  "node_args": {
    "type": [
      "array",
      "string"
    ]
  },
  "name": {
    "type": "string"
  },
  "max_memory_restart": {
    "type": [
      "string",
      "number"
    ],
    "regex": "^\\d+(G|M|K)?$",
    "ext_type": "sbyte",
    "desc": "it should be a NUMBER - byte, \"[NUMBER]G\"(Gigabyte), \"[NUMBER]M\"(Megabyte) or \"[NUMBER]K\"(Kilobyte)"
  },
  "instances": {
    "type": "number",
    "min": 0
  },
  "log_file": {
    "type": [
      "boolean",
      "string"
    ],
    "alias": "log"
  },
  "error_file": {
    "type": "string",
    "alias": "error"
  },
  "out_file": {
    "type": "string",
    "alias": "output"
  },
  "pid_file": {
    "type": "string",
    "alias": "pid"
  },
  "cron_restart": {
    "type": "string",
    "alias": "cron"
  },
  "cwd": {
    "type": "string"
  },
  "merge_logs": {
    "type": "boolean"
  },
  "watch": {
    "type": "boolean"
  },
  "ignore_watch": {
    "type": [
      "array",
      "string"
    ]
  },
  "watch_options": {
    "type": "object"
  },
  "env": {
    "type": ["object", "string"]
  },
  "^env_\\S*$": {
    "type": [
      "object",
      "string"
    ]
  },
  "log_date_format": {
    "type": "string"
  },
  "min_uptime": {
    "type": [
      "number",
      "string"
    ],
    "regex": "^\\d+(h|m|s)?$",
    "desc": "it should be a NUMBER - milliseconds, \"[NUMBER]h\"(hours), \"[NUMBER]m\"(minutes) or \"[NUMBER]s\"(seconds)",
    "min": 100,
    "ext_type": "stime"
  },
  "max_restarts": {
    "type": "number",
    "min": 0
  },
  "exec_mode": {
    "type": "string",
    "regex": "^(cluster|fork)(_mode)?$",
    "alias": "executeCommand",
    "desc": "it should be \"cluster\"(\"cluster_mode\") or \"fork\"(\"fork_mode\") only"
  },
  "exec_interpreter": {
    "type": "string",
    "alias": "interpreter"
  },
  "write": {
    "type": "boolean"
  },
  "force": {
    "type": "boolean"
  }
}
```

### Considerations

- All command line options passed when using the JSON app declaration will be dropped i.e.
```bash
$ cat node-app-1.json

{
  "name" : "node-app-1",
  "script" : "app.js",
  "cwd" : "/srv/node-app-1/current"
}
```

- You can start as many JSON app declarations as you want.  Continuing from above:
```bash
$ pm2 start node-app-2.json
$ ps aux | grep node-app
root  14735  5.8  1.1  752476  83932 ? Sl 00:08 0:00 pm2: node-app-1
root  24271  0.0  0.3  696428  24208 ? Sl 17:36 0:00 pm2: node-app-2
```

Note that if you execute `pm2 start node-app-2` again, it will spawn an additional instance node-app-2.

- **cwd:** your JSON declaration does not need to reside with your script.  If you wish to maintain the JSON(s) in a location other than your script (say, `/etc/pm2/conf.d/node-app.json`) you will need to use the `cwd` feature (Note, this can be really helpful for capistrano style directory structures that uses symlinks). Files can be either relative to the `cwd` directory, or absolute (see example below).


- All the keys can be used in a JSON configured file, but will remain almost the same on the command line e.g.:

```
exec_interpreter  -> --interpreter
exec_mode         -> --execute_command
max_restarts      -> --max_restarts
force             -> --force
```

If the `alias` exists, you can use it as a CLI option, but do not forget to turn the camelCasing to underscore split `executeCommand` to `--execute_command`.


**Notes**
- Using quotes to make an ESC, e.g.:

  ```
  $pm2 start test.js --node-args "port=3001 sitename='first pm2 app'"
  ```

  The `nodeArgs` argument will be parsed as

  ```JSON
  [
    "port=3001",
    "sitename=first pm2 app"
  ]
  ```

  but not

  ```JSON
  [
    "port=3001",
    "sitename='first",
    "pm2",
    "app'"
  ]
  ```

- RegExp key

  Matches the keys of configured JSON by RegExp (not by string comparison), e.g. `^env_\\S*$` will match all `env` keys like `env_production`, `env_test`, and valid them according to the schemas specifications.

- Special `ext_type`

  - min_uptime

    Value of `min_uptime` can be:

      - **Number**
        e.g. `"min_uptime": 3000` means 3000 milliseconds.
      - **String**
        Therefore, we are making it short and easy to configure: `h`, `m` and `s`, e.g.: `"min_uptime": "1h"` means one hour, `"min_uptime": "5m"` means five minutes and `"min_uptime": "10s"` means ten seconds (those will be transformed into milliseconds).

  - max_memory_restart

    Value of `max_memory_restart` can be:
      - **Number**
        e.g. `"max_memory_restart": 1024` means 1024 bytes (**NOT BITS**).
      - **String**
        Therefore, we are making it short and easy to configure: `G`, `M` and `K`, e.g.: `"max_memory_restart": "1G"` means one gigabytes, `"max_memory_restart": "5M"` means five megabytes and `"max_memory_restart": "10K"` means ten kilobytes (those will be transformed into byte(s)).

- Optional values

  For example `exec_mode` can take `cluster` (`cluster_mode`) or `fork` (`fork_mode`) as possible values.

- Things to know

  - maximum

    `"instances": 0` means that we will launch the maximum processes possible according to the numbers of CPUs (cluster mode)
  - array

    `args`, `node_args` and `ignore_watch` could be type of `Array` (e.g.: `"args": ["--toto=heya coco", "-d", "1"]`) or `string` (e.g.: `"args": "--to='heya coco' -d 1"`)

<a name="windows"/>
# Windows

Make sure you have tail.exe in your path, confirm using "where"

```
C:\>where tail
C:\Program Files (x86)\Git\bin\tail.exe
```

Tail can be found as part of [Git](https://msysgit.github.io/), Cygwin and MingW packages. Tail needs to be able to support "-f" and "-n" options.

<a name="deployment"/>
# Deployment

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
      "post-deploy" : "pm2 startOrRestart ecosystem.json --env dev",
      "env"  : {
        "NODE_ENV": "dev"
      }
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

## Using file key for authenticating

Just add the "key" attribute with file path to the .pem key within the attributes "user", "hosts"...

```
    "production" : {
      "key"  : "/path/to/some.pem",
      "user" : "node",
      "host" : "212.83.163.1",
      "ref"  : "origin/master",
      "repo" : "git@github.com:repo.git",
      "path" : "/var/www/production",
      "post-deploy" : "pm2 startOrRestart ecosystem.json --env production"
    },
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
      <td>pm2.start(script_path|json_object|json_path, options, fn(err, proc){})</td>
    </tr>
    <tr>
      <td>Options </td>
      <td>
      nodeArgs(arr), scriptArgs(arr), name(str), instances(int), error(str), output(str), pid(str), cron(str), mergeLogs(bool), watch(bool), runAsUser(int), runAsGroup(int), executeCommand(bool), interpreter(str), write(bool)</td>
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
PM2_KILL_TIMEOUT
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

```json
[{
  "name" : "ES6",
  "script" : "es6.js",
  "node_args" : "--harmony"
}]
```

<a name="a19"/>
## CoffeeScript

```bash
$ pm2 start server.coffee --interpreter coffee
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

### JSON configuration

To run a non-JS interpreter you must set `exec_mode` to `fork_mode` and `exec_interpreter` to your interpreter of choice.
For example:

```json
{
  "apps" : [{
    "name"       : "bash-worker",
    "script"     : "./a-bash-script",
    "exec_interpreter": "bash",
    "exec_mode"  : "fork_mode"
  }, {
    "name"       : "ruby-worker",
    "script"     : "./some-ruby-script",
    "exec_interpreter": "ruby",
    "exec_mode"  : "fork_mode"
  }]
}
```

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
- [EACCESS - understanding pm2 user/root rights](https://github.com/Unitech/PM2/issues/837)

<a name="a20"/>
## External resources and articles

- [Goodbye node-forever, hello pm2](http://devo.ps/blog/goodbye-node-forever-hello-pm2/)
- [https://serversforhackers.com/editions/2014/11/04/pm2/](https://serversforhackers.com/editions/2014/11/04/pm2/)
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
