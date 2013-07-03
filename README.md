![Monit](https://github.com/unitech/pm2/raw/master/pres/pm22.png)

[![Build Status](https://travis-ci.org/Unitech/pm2.png)](https://travis-ci.org/Unitech/pm2)
[![Build Status](https://david-dm.org/Unitech/pm2.png)](https://david-dm.org/Unitech/pm2)
[![NPM version](https://badge.fury.io/js/pm2.png)](http://badge.fury.io/js/pm2)

The modern CLI process manager for Node apps with native clusterization.

Tested with Node v0.8, v0.10, v0.11
Works on Linux & MacOS

# Installation

```bash
npm install -g pm2
```

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
$ pm2 restart pm2_id     # Restart specific process
$ pm2 restartAll         # Restart all proccesses
$ pm2 stopAll            # Stop all processes
$ pm2 generate app       # Generate a JSON process configuration
$ pm2 web                # Health computer API endpoint (http://localhost:9615)
```

## Different ways of starting a process

```bash
$ pm2 start app.js -i max  # Will start maximum processes depending on CPU availables
$ pm2 start app.js -i 3    # Will start 3 processes
$ pm2 start app.json       # Start processes with options declared in app.json
                           # Go to chapter Multi process JSON declaration for more
                           
$ pm2 start app.js -c "* * * * * *" # Will restart the process depending on the
                                    # cron pattern. Here it will restart the process
                                    # every second

$ pm2 start app.js -i max -- -a 23  # Pass arguments after -- to app.js
$ pm2 start app.js -i max -e err.log -o out.log -w  # Will start and generate a configuration file
```

## Updating pm2 and keeping processes alive

```bash
$ pm2 dump
$ npm install -g pm2@latest
$ pm2 kill
$ pm2 resurrect
```

## Is my production server ready for PM2 ?

Just try the tests before using PM2 on your production server

```bash
$ git clone https://github.com/Unitech/pm2.git
$ cd pm2
$ npm install  # Or do npm install --dev if devDependencies are not installed
$ npm test
```

If a test is broken please report us issues [here](https://github.com/Unitech/pm2/issues?state=open)

## How to install the pm2 master branch

```bash
npm install git://github.com/Unitech/pm2.git -g
```

## pm2 context

pm2 permits you to daemonize node.js scripts very easily.
All processes popped with pm2 inherit the entire environment.

## pm2 list

List infos about all processes managed by pm2. It shows also how many times a process has been restarted because of an unhandled exception.

![Monit](https://github.com/unitech/pm2/raw/master/pres/pm2-list.png)

## pm2 monit

Monitor CPU and memory usage of every node process (and also clustered processes) managed by pm2.

![Monit](https://github.com/unitech/pm2/raw/master/pres/pm2-monit.png)

## pm2 logs

Display logs in streaming of all processes, without having to do a tail -f or something else.

![Monit](https://github.com/unitech/pm2/raw/master/pres/pm2-logs.png)

## pm2 dump/resurrect

You can dump all currently running processes, including their environment and execution path.
After restarting or stopping PM2 you can `resurrect` them. 

![Monit](https://github.com/unitech/pm2/raw/master/pres/pm2-resurect.png)

## pm2 cron restart

The `-c "cron_pattern"` option permits to hard restart a process scheduled on the cron pattern.

## pm2 health web api endpoint

PM2 can disserve an API endpoint to monitor processes and computer health (cpu usage, memory, network interfaces...)

```
pm2 web
```

# Features

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
    "instances" : "4"
},{
    "name"      : "bus",
    "script"    : "./examples/echokill.js"
}]
```

Then with the cli :
```bash
$ pm2 start processes.json
```

# Test

```bash
npm test
```

# Next Features

- Remote administration/status checking
- Builtin Inter process communication channel (message bus)
- Auto start of the script at start (upstart)
- V8 GC memory leak detection
- Web interface
- Keeping monitoring data
- Integrated wrk utils endpoint benchmark

# Install a process (draft, not implemented)

You can install processes and communicate with them
```bash
$ m2 install web-pm2
$ m2 list
$ m2 start web-pm2
$ m2 info web-pm2  # list 
```

- Add homogen communication channel (pubsub/eventemitter2 - wildcard events) (axon pub/sub-message.js)

# Sponsors

Thanks to [Devo.ps](http://devo.ps/) and [Wiredcraft](http://wiredcraft.com/) for their knowledge and expertise.

# License

(The MIT License)

Copyright (c) 2011-2013 Strzelewicz Alexandre <as@unitech.io>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
