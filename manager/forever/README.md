# forever [![Build Status](https://secure.travis-ci.org/nodejitsu/forever.png)](http://travis-ci.org/nodejitsu/forever)

A simple CLI tool for ensuring that a given script runs continuously (i.e. forever).

## Installation

``` bash
  $ [sudo] npm install forever -g
```

**Note:** If you are using forever _programatically_ you should install [forever-monitor][0].

``` bash
  $ cd /path/to/your/project
  $ [sudo] npm install forever-monitor
```

## Usage
There are two distinct ways to use forever: through the command line interface, or by requiring the forever module in your own code. **Note:** If you are using forever _programatically_ you should install [forever-monitor][0].

### Using forever from the command line
You can use forever to run any kind of script continuously (whether it is written in node.js or not). The usage options are simple:

```
  $ forever --help
  usage: forever [action] [options] SCRIPT [script-options]

  Monitors the script specified in the current process or as a daemon

  actions:
    start               Start SCRIPT as a daemon
    stop                Stop the daemon SCRIPT
    stopall             Stop all running forever scripts
    restart             Restart the daemon SCRIPT
    restartall          Restart all running forever scripts
    list                List all running forever scripts
    config              Lists all forever user configuration
    set <key> <val>     Sets the specified forever config <key>
    clear <key>         Clears the specified forever config <key>
    logs                Lists log files for all forever processes
    logs <script|index> Tails the logs for <script|index>
    columns add <col>   Adds the specified column to the output in `forever list`
    columns rm <col>    Removed the specified column from the output in `forever list`
    columns set <cols>  Set all columns for the output in `forever list`
    cleanlogs           [CAREFUL] Deletes all historical forever log files

  options:
    -m  MAX          Only run the specified script MAX times
    -l  LOGFILE      Logs the forever output to LOGFILE
    -o  OUTFILE      Logs stdout from child script to OUTFILE
    -e  ERRFILE      Logs stderr from child script to ERRFILE
    -p  PATH         Base path for all forever related files (pid files, etc.)
    -c  COMMAND      COMMAND to execute (defaults to node)
    -a, --append     Append logs
    -f, --fifo       Stream logs to stdout
    -n, --number     Number of log lines to print
    --pidFile        The pid file
    --sourceDir      The source directory for which SCRIPT is relative to
    --minUptime      Minimum uptime (millis) for a script to not be considered "spinning"
    --spinSleepTime  Time to wait (millis) between launches of a spinning script.
    --plain          Disable command line colors
    -d, --debug      Forces forever to log debug output
    -v, --verbose    Turns on the verbose messages from Forever
    -s, --silent     Run the child script silencing stdout and stderr
    -w, --watch      Watch for file changes
    --watchDirectory Top-level directory to watch from
    -h, --help       You're staring at it

  [Long Running Process]
    The forever process will continue to run outputting log messages to the console.
    ex. forever -o out.log -e err.log my-script.js

  [Daemon]
    The forever process will run as a daemon which will make the target process start
    in the background. This is extremely useful for remote starting simple node.js scripts
    without using nohup. It is recommended to run start with -o -l, & -e.
    ex. forever start -l forever.log -o out.log -e err.log my-daemon.js
        forever stop my-daemon.js
```

There are [several examples][1] designed to test the fault tolerance of forever. Here's a simple usage example:

``` bash
  $ forever -m 5 examples/error-on-timer.js
```

## Using forever module from node.js
In addition to using a Forever object, the forever module also exposes some useful methods. Each method returns an instance of an EventEmitter which emits when complete. See the [forever cli commands][2] for sample usage.

**Remark:** As of `forever@0.6.0` processes will not automatically be available in `forever.list()`. In order to get your processes into `forever.list()` or `forever list` you must instantiate the `forever` socket server:

``` js
  forever.startServer(child);
```

### forever.load (config)
_Synchronously_ sets the specified configuration (config) for the forever module. There are two important options:

* root:    Directory to put all default forever log files
* pidPath: Directory to put all forever *.pid files

### forever.start (file, options)
Starts a script with forever.

### forever.startDaemon (file, options)
Starts a script with forever as a daemon. WARNING: Will daemonize the current process.

### forever.stop (index)
Stops the forever daemon script at the specified index. These indices are the same as those returned by forever.list(). This method returns an EventEmitter that raises the 'stop' event when complete.

### forever.stopAll (format)
Stops all forever scripts currently running. This method returns an EventEmitter that raises the 'stopAll' event when complete.

### forever.list (format, callback)
Returns a list of metadata objects about each process that is being run using forever. This method is synchronous and will return the list of metadata as such. Only processes which have invoked `forever.startServer()` will be available from `forever.list()`

### forever.tail (target, options, callback)
Responds with the logs from the target script(s) from `tail`. There are two important options:

* `length` (numeric): is is used as the `-n` parameter to `tail`.
* `stream` (boolean): is is used as the `-f` parameter to `tail`.

### forever.cleanUp ()
Cleans up any extraneous forever *.pid files that are on the target system. This method returns an EventEmitter that raises the 'cleanUp' event when complete.

### forever.cleanLogsSync (processes)
Removes all log files from the root forever directory that do not belong to current running forever processes.

## Run Tests

``` bash
  $ npm test
```

#### License: MIT
#### Author: [Charlie Robbins](http://github.com/indexzero)
#### Contributors: [Fedor Indutny](http://github.com/indutny), [James Halliday](http://substack.net/), [Charlie McConnell](http://github.com/avianflu), [Maciej Malecki](http://github.com/mmalecki), [John Lancaster](http://jlank.com)

[0]: http://github.com/nodejitsu/forever-monitor
[1]: http://github.com/nodejitsu/forever-monitor/tree/master/examples
[2]: https://github.com/nodejitsu/forever/blob/master/lib/forever/cli.js
