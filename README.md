# ![Monit](https://github.com/unitech/pm2/raw/master/pres/top-logo-wo.png)

pm2 is a process manager for Node apps with a builtin load-balancer. 

## Tech notes

pm2 is perfect when you need to spread your stateless code accross all CPUs available on a server, to keep all processes alive forever and to 0s reload it.
Good fit for IaaS structures. Don't use it on PaaS solutions (a solution for PaaS will be developed later).

# Main features

- Builtin load-balancer (using the node cluster module)
- Script daemonization
- 0s downtime reload
- Startup scripts for Ubuntu and CentOS
- Stop unstable process (avoid infinite loop)
- Monitoring in console
- HTTP API
- [Remote control and real time interface API](https://github.com/Unitech/pm2-interface)

Tested with Node v0.11, v0.10, v0.8 (https://travis-ci.org/Unitech/pm2).
Compatible CoffeeScript.
Works on Linux & MacOS.

[![Build Status](https://travis-ci.org/Unitech/pm2.png)](https://travis-ci.org/Unitech/pm2)
[![Build Status](https://david-dm.org/Unitech/pm2.png)](https://david-dm.org/Unitech/pm2)
[![NPM version](https://badge.fury.io/js/pm2.png)](http://badge.fury.io/js/pm2)

[![NPM](https://nodei.co/npm/pm2.png?downloads=true)](https://nodei.co/npm/pm2.png?downloads=true)

# Readme Contents

- [Installation](#a1)
- [Usage/Features](#a2)
- [Different ways to launch a process](#a3)
- [0s downtime reload](#a16)
- [CoffeeScript](#a19)
- [Is my production server ready for PM2](#a4)
- [Listing processes : pm2 list](#a6)
- [Monitoring processes (CPU/RAM) : pm2 monit](#a7)
- [Startup script generation : pm2 startup](#a8)
- [Log aggregation : pm2 logs](#a9)
- [Fork mode](#a23)
- [Customization](#a24)
- [API health end point : pm2 web](#a12)
- [JSON processes declaration](#a13)
- [Contributing/Development mode](#a27)
- [Known bugs](#a21)
- [Launching the tests](#a4)
- [They talk about it](#a20)
- [License](#a15)

<a name="a1"/>
# Installation

```bash
npm install -g pm2
```

<a name="a2"/>
# Usage/Features

```bash
$ npm install pm2 -g     # Install pm2 command line globally
$ pm2 start app.js -i 4  # Daemonize pm2 and Start 4 clustered instances of app.js
                         # You can also pass the 'max' params to start 
                         # the right numbers of processes depending of CPUs

$ pm2 start app.js --name my-api # Name process

$ pm2 list               # Display all processes status
$ pm2 monit              # Monitor all processes
$ pm2 logs               # Display all processes logs in streaming

$ pm2 stop all           # Stop all processes
$ pm2 restart all        # Restart all processes

$ pm2 reload all         # Will 0s downtime reload (for NETWORKED processes)

$ pm2 stop 0             # Stop specific process id
$ pm2 restart 0          # Restart specific process id

$ pm2 startup            # Generate init script to keep processes alive

$ pm2 web                # Launch Health computer API endpoint (http://localhost:9615)

$ pm2 delete 0           # Will remove process from pm2 list
$ pm2 delete all         # Will remove all processes from pm2 list
```

<a name="a3"/>
## Different ways to launch a process

```bash
$ pm2 start app.js -i max  # Will start maximum processes depending on CPU availables

$ pm2 start app.js -i 3    # Will start 3 processes

$ pm2 start app.js -x            # Start app.js in fork mode instead of cluster
$ pm2 start app.js -x -- -a 23   # Start app.js in fork mode and pass arguments (-a 23)

$ pm2 start app.js --name serverone # Start a process an name it as server one
                                    # you can now stop the process by doing
                                    # pm2 stop serverone
                                    
$ pm2 start app.json                # Start processes with options declared in app.json
                                    # Go to chapter Multi process JSON declaration for more
                           
$ pm2 start app.js -i max -- -a 23  # Pass arguments after -- to app.js

$ pm2 start app.js -i max -e err.log -o out.log  # Will start and generate a configuration file
```

You can also execute app in other languages ([the fork mode](#a23)):
```bash
$ pm2 start my-bash-script.sh -x --interpreter bash

$ pm2 start my-python-script.py -x --interpreter python
```

<a name="a16"/>
## 0s downtime reload

This feature permits to reload code without loosing queries connection.

Warning :
- Only for networked app
- Running on Node 0.11.x
- In cluster mode (default mode)

```bash
$ pm2 reload all
```

Thanks to TruongSinh Tran-Nguyen https://github.com/truongsinh

<a name="a19"/>
## CoffeeScript

```bash
$ pm2 start my_app.coffee
```

That's all !

<a name="a23"/>
## Fork mode - execute script in different languages

The default mode of PM2 consists of wrapping the code of your node app into the Node Cluster module. It's called the **cluster mode**.
There is also a more classical way to execute your app, like node-forever do, called the **fork mode**.

In fork mode all options are the same than the cluster mode (restart, delete...). 

**By using the fork mode you will loose core features of PM2 like the automatic clusterization of your code over all CPUs available and the 0s reload.**

So use it if you only need a forever like behaviour.

Here is how to start your app in fork : 

```bash
$ pm2 start app.js -x   # Will start your app.js in fork mode
$ pm2 list              # You will see that on the row "mode" it's written "fork"
```

You can also exec scripts in other languages :

```bash
$ pm2 start my-bash-script.sh -x --interpreter bash

$ pm2 start my-python-script.py -x --interpreter python
```

<a name="a4"/>
## Is my production server ready for PM2 ?

Just try the tests before using PM2 on your production server

```bash
$ git clone https://github.com/Unitech/pm2.git
$ cd pm2
$ npm install  # Or do NODE_ENV=development npm install if some packages are missing
$ npm test
```

If a test is broken please report us issues [here](https://github.com/Unitech/pm2/issues?state=open)

<a name="a6"/>
## pm2 list

List infos about all processes managed by pm2. It shows also how many times a process has been restarted because of an unhandled exception.

![Monit](https://github.com/unitech/pm2/raw/master/pres/pm2-list.png)

<a name="a7"/>
## pm2 monit

Monitor CPU and memory usage of every node process (and also clustered processes) managed by pm2.

![Monit](https://github.com/unitech/pm2/raw/master/pres/pm2-monit.png)

<a name="a8"/>
## pm2 automatic startup script generation

PM2 provides an automatic way to keep Node processes alive on server restart.
On exit it will dump the process list and their environment and will resurrect them on startup. 
It uses **System V init script** compatible with **Ubuntu and CentOS** (maybe it works on other sys but not 100% sure).

```bash
$ pm2 startup  # then follow the command instruction
```

### Running script as a different user

The `-u username` option permits to specify which user has to start the process at startup. 
**NOTE** that this user must have access to npm, apps and node ! So the best way is to log with this user `su -l www`, then do `pm2 startup -u www`.

Internally it uses `sudo -u $USER`.


<a name="a9"/>
## pm2 logs

Display logs in streaming of all processes, without having to do a tail -f or something else.
You can also pass [name|id] as parameter to stream only the log of a specified process.

![Monit](https://github.com/unitech/pm2/raw/master/pres/pm2-logs.png)

<a name="a12"/>
## pm2 health web api endpoint

PM2 can disserve an API endpoint to monitor processes and computer health (cpu usage, memory, network interfaces...)

```
pm2 web
```

<a name="a24"/>
## Customization

Multiple variables can be customized via the environment :

```
  DAEMON_BIND_HOST   : process.env.PM2_BIND_ADDR || 'localhost',
  DAEMON_RPC_PORT    : process.env.PM2_RPC_PORT  || 6666, // RPC commands
  DAEMON_PUB_PORT    : process.env.PM2_PUB_PORT  || 6667, // Realtime events
  DEBUG              : process.env.PM2_DEBUG || false,
  WEB_INTERFACE      : process.env.PM2_API_PORT  || 9615,
```

<a name="a13"/>
# Multi process JSON declaration

processes.json : 

```json
[{
  "name"      : "echo",
  "script"    : "./examples/args.js",
  "args"      : "['--toto=heya coco', '-d', '1']",
  "exec_mode" : "fork_mode"
},{
    "name"       : "api",
    "script"     : "./examples/child.js",
    "instances"  : "4",
    "error_file" : "./examples/child-err.log",
    "out_file"   : "./examples/child-out.log",
    "exec_mode"  : "cluster_mode",
    "port"       : 9005
},{
  "min_uptime" : "100",
  "max_restarts" : "400",
  "name" : "auto-kill",
  "script" : "./examples/killfast.js"
}]
```

Then with the cli :
```bash
$ pm2 start processes.json
```

**Notes** 
- every line you add like `"port" : 9005` is present in the process environment

### Special options with JSON process declaration

- "min_uptime":
if a process is restarted with an uptime smaller than this value,
this restart counts as an unstable restart. If this option is not specified,
all restarts are considered unstable.

- "max_restarts":
if the number of unstable restarts exceeds this number,
the process will be stopped and a message with number with restarts will be logged.


<a name="a27"/>
# Contributing/Development mode

Fork PM2 and to hack it it's pretty simple :

```
$ pm2 kill   # kill the current pm2
$ git clone my_pm2_fork.git
$ cd pm2/
$ DEBUG=* PM2_DEBUG=true./bin/pm2 start xxx.js
```

Everytime you do a modification on the code you have to restart pm2, so just do a `./bin/pm2 kill` before
starting an app or something else.
You have to restart it because the code is daemonized on the memory.

<a name="a21"/>
# Known bugs and workarounds

First, install the lastest pm2 version :

```bash
$ npm install -g pm2@latest
```

- Node 0.10.x doesn't free script port when stopped. It's due to the NodeJS cluster module.
So if you feel that this problem is important for your use case, use the fork mode the [fork mode](#a23) instead.
By using the fork mode you will loose core features of PM2 like the automatic clusterization of your code over all CPUs available and the 0s reload.

```
$ pm2 start index.js -x  # start my app in fork mode
```

For more informations about this issue : [#74](https://github.com/Unitech/pm2/issues/74)

- `Cannot read property 'getsockname' of undefined`

When using the cluster mode (by default) you can't use ports from 0 to 1024. If you really need to exec in this range use the [fork mode](#a23) with the `-x` parameter.
By using the fork mode you will loose core features of PM2 like the automatic clusterization of your code over all CPUs available and the 0s reload.

<a name="a14"/>
# Test

```bash
npm test
```

<a name="a20"/>
# They talk about it

- http://devo.ps/blog/2013/06/26/goodbye-node-forever-hello-pm2.html
- https://coderwall.com/p/igdqyw
- http://revdancatt.com/2013/09/17/node-day-1-getting-the-server-installing-node-and-pm2/
- https://medium.com/tech-talk/e7c0b0e5ce3c

# MISC

## Code structure

![Monit](https://github.com/unitech/pm2/raw/master/pres/Drawing1.png)

## Features

- Clusterize your Node networked script without adding one line of code
- Fully tested
- Monitor process/cluster processes health (status, memory, cpu usage, restarted time) via CLI (htop like)
- Monitor server health (processes, cpu core...) via JSON api (pm2 web)
- Launch multiple applications via JSON
- Forever keep alive processes
- Log streaming in realtime (pm2 logs)
- Log uncaught exceptions in error logs
- Track restarted time
- Auto stop processes who exit too fast
- Dump current processes and resurrect (upstart)

## Idea bucket

- Remote administration/status checking
- Builtin Inter process communication channel (message bus)
- Auto start of the script at start (upstart)
- V8 GC memory leak detection
- Web interface
- Keeping monitoring data
- Integrated wrk utils endpoint benchmark
- Add homogen communication channel (pubsub/eventemitter2 - wildcard events) (axon pub/sub-message.js)

## Sponsors

Thanks to [Devo.ps](http://devo.ps/) and [Wiredcraft](http://wiredcraft.com/) for their knowledge and expertise.

[![Bitdeli Badge](https://d2weczhvl823v0.cloudfront.net/Unitech/pm2/trend.png)](https://bitdeli.com/free "Bitdeli Badge")

<a name="a15"/>
# License - Apache License v2

Copyright [2013] [Strzelewicz Alexandre <as@unitech.io>]
  
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
           
    http://www.apache.org/licenses/LICENSE-2.0
                  
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
