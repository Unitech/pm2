![Monit](https://github.com/unitech/pm2/raw/master/pres/pm2.png)

[![Build Status](https://travis-ci.org/Unitech/pm2.png)](https://travis-ci.org/Unitech/pm2)
[![Build Status](https://david-dm.org/Unitech/pm2.png)](https://david-dm.org/Unitech/pm2)

The next generation process manager for Node.js.

Automatic clusterisation, upstart scripts, keep alive process, process monitoring, logs aggregation.

# Installation

```
npm install -g pm2
```

# Quick start

```
$ npm install pm2 -g     // Install pm2 command line globally
$ pm2 start app.js -i 4  // Start 4 clustered instances of app.js

$ pm2 list               // Display the status of the processes
$ pm2 monit              // Monitor all processes
$ pm2 logs               // Display all processes logs in streaming
$ pm2 dump               // Dump the states of all processes
$ pm2 stop               // Stop all processes
$ pm2 resurect           // Put online previously dumped processes
$ pm2 restart            // Restart all proccesses
$ pm2 stop
$ pm2 generate app       // Generate a JSON process configuration
```

## pm2 list

List infos about all processes managed by pm2. It shows also how many times a process has been restarted because of an unhandled exception.

![Monit](https://github.com/unitech/pm2/raw/master/pres/pm2-list.png)

## pm2 monit

Monitor CPU and memory usage of every node process (and also clustered processes) managed by pm2.

![Monit](https://github.com/unitech/pm2/raw/master/pres/pm2-monit.png)

## pm2 logs

Display logs in streaming of all processes, without having to do a tail -f or something else.

![Monit](https://github.com/unitech/pm2/raw/master/pres/pm2-logs.png)

## pm2 dump/resurect

You can dump all currently running processes, including their environment and execution path.
After restarting or stopping PM2 you can `resurect` them. 

![Monit](https://github.com/unitech/pm2/raw/master/pres/pm2-resurect.png)

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
- Dump current processes and resurect (upstart)

# Multi process JSON declaration

processes.json : 

```
[{
    "name" : "echo",
    "script" : "./examples/echo.js",
    "max" : "10"
},{
    "name" : "api",
    "script" : "./examples/child.js",
    "instances" : "4"
},{
    "name" : "bus",
    "script" : "./examples/echokill.js"
}]
```

Then with the cli :
```
$ pm2 start processes.json
```

# Test

```
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
```
$ m2 install web-pm2
$ m2 list
$ m2 start web-pm2
$ m2 info web-pm2    // list 
```

- Add homogen communication channel (pubsub/eventemitter2 - wildcard events) (axon pub/sub-message.js)

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
