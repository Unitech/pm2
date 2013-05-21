# pm2.js

pm2 is a wrapper around forever to provide extended features (cli and programatic) for managing and monitoring Node.js application.
Manage and monitor applications via JSON, fork functions, manage process programaticaly (for test for example).

## Install 

```
npm install -g pm2
```

## CLI teasing

Process or programs are encapsulated into json file of this format :

Generate application manager file : 

```
$ pm2 generate
Name : sample
```

sample-pm2.json :
```js
{
    "path" : "sample.js",       // File to execute
    "outFile" : "out-sample.log",
    "errFile" : "err-sample.log",
    "pidFile" : "sample.pif",
    "options": ["foo"],
    "env": {
       "DEBUG": "*",
       "PM_APP_TITLE" : "sample"
    }    
}
```

Then you launch it by doing :
```bash
$ pm2 start sample-pm2.json
```
array.json :
```js
[{
    "path": "bin/echo.js",
    "outFile": "out-echo.log",
    "errFile": "err-echo.log",
    "pidFile": "echo.log",
    "options": ""
}, {
    "path": "bin/echo.js",
    "outFile": "out-echo.log",
    "errFile": "err-echo.log",
    "pidFile": "echo.log",
    "options": ""
}]
```

Then you also can launch it by doing :
```bash
$ pm2 start array.json
```

After this you can easily :
```bash
Monitor processes in terminal :
$ pm2 monit

Show all the logs in stream :
$ pm2 logs

Listing processes in json format : 
$ pm2 jlist

Stop all :
$ pm2 stop
```

![Yay](http://mothership.sourceforge.net/mothership.png)

## Format of an App

my_app.json :
```js
{
    "path" : "../index.js",
    "outFile" : "out-api.log",
    "errFile" : "err-api.log",
    "pidFile" : "api.log",
    "options" : ""
}
```

Then you can launch the process in CLI way with `pm2 start my_app.json`

## Commands available

Commands available :

```
pm2 -h          // Display help

pm2 start api   // Spawn api (config in ./api.js)
pm2 start bus   // Spawn bus (config in ./bus.js)

OR by passing a JSON file

pm2 start apps/api.json

pm2 generate    // Generate a sample JSON file

pm2 monit       // Display memory and cpu usage of each process

pm2 logs        // Display logs in streaming of each process

pm2 list        // List all processes
pm2 jlist       // List all processes in json format
pm2 stop        // Stop all processes
```

## System API application

An app is included with pm2, a webinterface between the system and the web which permits to get the health state of the machine and running process launched with process-manager (pm2).

To launch it :
```
pm2 start apps/webinterface.json // the webinterface is in the pm2 module
```

Then go to localhost:4000, the json contains :
- System info (hostname + uptime)
- List of processes launched with process-manager (pm2)
- System load average
- Memory usage
- CPU infos and usage
- Interfaces

**Todo**
Using websocket to stream logs in live to web clients

## Managing processes programaticaly

PM2 don't only manage process with the cli.
It also provides libraries to easily fork functions into another process, to launch process, and manage them.

### Starting application from the code

Launch app from the code, and you can still manage them with pm2 cli.

```js
var pm2 = require('../index.js').pm2;

pm2.use('api').use('bus'),start(function() {
    console.log('Application API and BUS has been launched');
});
```

**Example**
In examples/worker.js

### Launching function in different processes

Working example provided in examples/decap.js
 
```js
var decap = require('pm2').decap;

function probe1() {
    setInterval(function() {
	console.log('I\'m running in another process');
    }, 1000);
};

decap(probe1);

setInterval(function() {
    console.log('im the main process');
}, 2000);
```

## Test

```
npm test
bash test/cli-test.sh
```

## TODO

## Options for json app file

```
  {
    //
    // Basic configuration options
    //
    'silent': false,            // Silences the output from stdout and stderr in the parent process
    'uid': 'your-UID'           // Custom uid for this forever process. (default: autogen)
    'pidFile': 'path/to/a.pid', // Path to put pid information for the process(es) started
    'max': 10,                  // Sets the maximum number of times a given script should run
    'killTree': true            // Kills the entire child process tree on `exit`
    
    //
    // These options control how quickly forever restarts a child process
    // as well as when to kill a "spinning" process
    //
    'minUptime': 2000,     // Minimum time a child process has to be up. Forever will 'exit' otherwise.
    'spinSleepTime': 1000, // Interval between restarts if a child is spinning (i.e. alive < minUptime).
    
    //
    // Command to spawn as well as options and other vars 
    // (env, cwd, etc) to pass along
    //
    'command': 'perl',         // Binary to run (default: 'node')
    'options': ['foo','bar'],  // Additional arguments to pass to the script,
    'sourceDir': 'script/path' // Directory that the source script is in
    
    //
    // Options for restarting on watched files.
    //
    'watch': false              // Value indicating if we should watch files.
    'watchIgnoreDotFiles': null // Dot files we should read to ignore ('.foreverignore', etc).
    'watchIgnorePatterns': null // Ignore patterns to use when watching files.
    'watchDirectory': null      // Top-level directory to watch from.
    
    //
    // All or nothing options passed along to `child_process.spawn`.
    //
    'spawnWith': {
      customFds: [-1, -1, -1], // that forever spawns.
      setsid: false
    },
    
    //
    // More specific options to pass along to `child_process.spawn` which 
    // will override anything passed to the `spawnWith` option
    //
    'env': { 'ADDITIONAL': 'CHILD ENV VARS' }
    'cwd': '/path/to/child/working/directory'
    
    //
    // Log files and associated logging options for this instance
    //
    'logFile': 'path/to/file', // Path to log output from forever process (when daemonized)
    'outFile': 'path/to/file', // Path to log output from child stdout
    'errFile': 'path/to/file'  // Path to log output from child stderr
  }
```

# Other way for disserving data

- websocket (can i display in the browser what i receive from websocket?)
--- module for node-websocket, just send json
--- disserving data with a node-ftp

- using spdy and push json ?
