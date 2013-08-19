![Monit](https://github.com/unitech/pm2/raw/master/pres/pm22.png)

The modern and stable CLI process manager for Node apps with native clusterization, monitoring, 0 downtime process restart, startup scripts and much more.

Tested with Node v0.12, v0.11, v0.10, v0.9, v0.8 (https://travis-ci.org/Unitech/pm2).
Works on Linux & MacOS.

[![NPM](https://nodei.co/npm/pm2.png)](https://nodei.co/npm/pm2/)

[![Build Status](https://travis-ci.org/Unitech/pm2.png)](https://travis-ci.org/Unitech/pm2)
[![Build Status](https://david-dm.org/Unitech/pm2.png)](https://david-dm.org/Unitech/pm2)
[![NPM version](https://badge.fury.io/js/pm2.png)](http://badge.fury.io/js/pm2)

Blog post for some context : [Goodbye node-forever, hello PM2](http://devo.ps/blog/2013/06/26/goodbye-node-forever-hello-pm2.html)

# Note

If you like this module or it solves something you always needed for your Node deployment, please support PM2 !

[![Donate](http://unitech.io/donate.png)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=TRF8NYRUVZXZ6)

I can also integrates very specific features or make a custom PM2 fitted for your need.
Contact me at : as@unitech.io

# Readme Contents

- [Installation](#a1)
- [Usage/Features](#a2)
- [Different ways to launch a process](#a3)
- [0 downtime process reloading](#a16)
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
$ pm2 reload all         # Reload all processes with 0 downtime
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
## 0 downtime process reloading

```
$ pm2 reload all
```

Thanks to TruongSinh Tran-Nguyen https://github.com/truongsinh

<a name="a5"/>
## Updating pm2 and resurecting process

```bash
$ pm2 dump
$ npm install -g pm2@latest
$ pm2 kill ; pm2 resurect
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


