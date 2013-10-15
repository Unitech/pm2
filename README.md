![Monit](https://github.com/unitech/pm2/raw/master/pres/top-logo.png)

Modern CLI process manager for Node apps with builtin load-balancer

**Main Features** : monitoring, hot code reload, builtin load balancer, fork mode, HTTP API, message bus, automatic startup script, resurrect/dump processes...

Tested with Node v0.11, v0.10, v0.9, v0.8 (https://travis-ci.org/Unitech/pm2).
Compatible CoffeeScript.
Works on Linux & MacOS.

[![Build Status](https://travis-ci.org/Unitech/pm2.png)](https://travis-ci.org/Unitech/pm2)
[![Build Status](https://david-dm.org/Unitech/pm2.png)](https://david-dm.org/Unitech/pm2)
[![NPM version](https://badge.fury.io/js/pm2.png)](http://badge.fury.io/js/pm2)

[![NPM](https://nodei.co/npm/pm2.png?downloads=true)](https://nodei.co/npm/pm2.png?downloads=true)

## This doc is for the 0.6.x pm2 version. **the 0.6x is not published on NPM for now, feel free to test it and tell me what you think** 

`npm install git://github.com/Unitech/pm2.git -g`

# Get the 0.5.7 for production server

If you install pm2 like that : `npm install pm2` it will install the 0.5.7.

For the pm2 0.5.x version please refer to this documentation : [0.5.x](https://github.com/Unitech/pm2/blob/0f0f4261ab21560d54bf39503ff01d4278096240/README.md)
To get sources of older pm2 versions please refer to releases : [0.5.x source](https://github.com/Unitech/pm2/releases)

# 0.6.x enhancements

![Monit](https://github.com/unitech/pm2/raw/master/pres/Drawing1.png)

- Code hardening
- Interface via [https://github.com/Unitech/pm2-interface](https://github.com/Unitech/pm2-interface)
- Environment enhanced
- Process state gestion (a process can be stopped and stay on the process list)
- Internal bus messaging system
- Fork mode via -x command (you can run non-node process)
- Enhancement on process monitoring, process listing (colors, uptime, status)
- 60 tests added


# Readme Contents

- [Installation](#a1)
- [Usage/Features](#a2)
- [Different ways to launch a process](#a3)
- [Hot code reload (0s downtime)](#a16)
- [CoffeeScript](#a19)
- [Is my production server ready for PM2](#a4)
- [Updating pm2 and keeping processes alive](#a5)
- [Listing processes : pm2 list](#a6)
- [Monitoring processes (CPU/RAM) : pm2 monit](#a7)
- [Startup script generation : pm2 startup](#a8)
- [Log aggregation : pm2 logs](#a9)
- [Dumping and resurrecting processes : pm2 dump/resurrect](#a10)
- [Scheduling application restart : CRON option](#a11)
- [API health end point : pm2 web](#a12)
- [JSON processes declaration](#a13)
- [Launching the tests](#a14)
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
$ pm2 list               # Display all processes status
$ pm2 monit              # Monitor all processes
$ pm2 logs               # Display all processes logs in streaming
$ pm2 dump               # Dump the states of all processes
$ pm2 stop pm2_id        # Stop specific process id
$ pm2 stopAll            # Stop all processes
$ pm2 resurrect          # Put online previously dumped processes
$ pm2 reload all         # Hot Reload all processes with 0s downtime (only for HTTP)
$ pm2 restart pm2_id     # Restart specific process
$ pm2 restart all        # Hard Restart all proccesses
$ pm2 stop all           # Stop all processes
$ pm2 generate app       # Generate a JSON process configuration
$ pm2 startup            # Generate init script to keep processes alive
$ pm2 web                # Health computer API endpoint (http://localhost:9615)
```

<a name="a3"/>
## Different ways to launch a process

```bash
$ pm2 start app.js -i max  # Will start maximum processes depending on CPU availables
$ pm2 start app.js -i 3    # Will start 3 processes
$ pm2 start app.js --name serverone # Start a process an name it as server one
                                    # you can now stop the process by doing
                                    # pm2 stop serverone
$ pm2 start app.json       # Start processes with options declared in app.json
                           # Go to chapter Multi process JSON declaration for more
                           
$ pm2 start app.js -c "* * * * * *" # Will restart the process depending on the
                                    # cron pattern. Here it will restart the process
                                    # every second

$ pm2 start app.js -i max -- -a 23  # Pass arguments after -- to app.js
$ pm2 start app.js -i max -e err.log -o out.log -w  # Will start and generate a configuration file
```

<a name="a4"/>
## Is my production server ready for PM2 ?

Just try the tests before using PM2 on your production server

```bash
$ git clone https://github.com/Unitech/pm2.git
$ cd pm2
$ npm install  # Or do npm install --dev if devDependencies are not installed
$ npm test
```

If a test is broken please report us issues [here](https://github.com/Unitech/pm2/issues?state=open)

<a name="a16"/>
## Hot code reload (0s downtime)

This feature permits to reload code without loosing current processed queries.
**ONLY FOR NETWORKED APPLICATIONS**

```
$ pm2 reload all
```

Thanks to TruongSinh Tran-Nguyen https://github.com/truongsinh

<a name="a19"/>
## CoffeeScript

```bash
$ pm2 start my_app.coffee
```

That's all !

<a name="a5"/>
## Updating pm2 and resurrecting process

```bash
$ pm2 dump
$ npm install -g pm2@latest
$ pm2 kill ; pm2 resurrect
```

## How to install the pm2 master branch

```bash
npm install git://github.com/Unitech/pm2.git -g
```

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

PM2 provides an automatic way to keep Node processes alive. It uses an init script (compatible with most Linux systems).

```bash
$ pm2 startup
```

Now you can reboot your server, and already launched processes should be kepts alive ;)

<a name="a9"/>
## pm2 logs

Display logs in streaming of all processes, without having to do a tail -f or something else.
You can also pass [name|id] as parameter to stream only the log of a specified process.

![Monit](https://github.com/unitech/pm2/raw/master/pres/pm2-logs.png)

<a name="a10"/>
## pm2 dump/resurrect

You can dump all currently running processes, including their environment and execution path.
After restarting or stopping PM2 you can `resurrect` them. 

![Monit](https://github.com/unitech/pm2/raw/master/pres/pm2-resurect.png)

<a name="a11"/>
## pm2 cron restart

The `-c "cron_pattern"` option permits to hard restart a process scheduled on the cron pattern.
Look at test/cli.sh for examples.

<a name="a12"/>
## pm2 health web api endpoint

PM2 can disserve an API endpoint to monitor processes and computer health (cpu usage, memory, network interfaces...)

```
pm2 web
```

<a name="a13"/>
# Multi process JSON declaration

processes.json : 

```json
[{
  "name"      : "echo",
  "script"    : "./examples/args.js",
  "instances" : "1",
  "args"      : "['--toto=heya coco', '-d', '1']",
  "cron_restart" : "* * * * * *"
},{
    "name"      : "api",
    "script"    : "./examples/child.js",
    "instances" : "4",
    "fileError" : "./examples/child-err.log",
    "fileOutput" : "./examples/child-out.log"
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

### Special options with JSON process declaration

- "min_uptime":
if a process is restarted with an uptime smaller than this value,
this restart counts as an unstable restart. If this option is not specified,
all restarts are considered unstable.

- "max_restarts":
if the number of unstable restarts exceeds this number,
the process will be stopped and a message with number with restarts will be logged.


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


## Next Features/Ideas

- Remote administration/status checking
- Builtin Inter process communication channel (message bus)
- Auto start of the script at start (upstart)
- V8 GC memory leak detection
- Web interface
- Keeping monitoring data
- Integrated wrk utils endpoint benchmark

## Install a process (draft, not implemented)

You can install processes and communicate with them
```bash
$ m2 install web-pm2
$ m2 list
$ m2 start web-pm2
$ m2 info web-pm2  # list 
```

- Add homogen communication channel (pubsub/eventemitter2 - wildcard events) (axon pub/sub-message.js)

## Sponsors

Thanks to [Devo.ps](http://devo.ps/) and [Wiredcraft](http://wiredcraft.com/) for their knowledge and expertise.


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
