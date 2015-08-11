# Modules system

A PM2 module is basically a NPM module. But this time it's not a library, but a process that will be runned in standalone mode with PM2.

Internally it embeds the NPM install procedure. So a PM2 module will be published to NPM and installed from NPM.

![Process listing](https://github.com/unitech/pm2/raw/master/pres/pm2-module.png)

## Basics

```bash
# INSTALL
$ pm2 install npm-module

# INSTALL GIT (username/repository)
$ pm2 install pm2-hive/pm2-docker

# UNINSTALL
$ pm2 uninstall npm-module

# UPDATE
$ pm2 install npm-module

# INCREMENT AND PUBLISH (need to commit to git commit also)
$ pm2 publish
```

## Development workflow

A workflow is available to easily develop new modules within the PM2 context

```bash
$ pm2 install .
$ pm2 logs <module-name>
$ pm2 uninstall <module-name>
```

- Every time an update is made the module will be automatically restarted
- Use pm2 logs to see how your app behaves

To debug what is sent to pm2 just set the following variable:
```
process.env.MODULE_DEBUG = true;
```

# What can I expose from a module?

A module can do pretty anything as Node.js application via Keymetrics can. You can use [custom metrics](https://github.com/keymetrics/pmx#measure), [custom actions](https://github.com/keymetrics/pmx#custom-action), scoped actions etc...

You can also report issue via pmx.notify([data])
Or event via pmx.emit([data])

## Expose custom Metrics

You can use Metric, Counter, Meter, Histograms

E.G. for metrics

```javascript
var probe = pmx.probe();

var metric = probe.metric({
  name  : 'Realtime user',
  agg_type: 'max',
  value : function() {
    return Object.keys(users).length;
  }
});
```

Refer to PMX documentation for other examples

## Expose remote Actions

Scoped Actions are advanced remote actions that can be triggered from Keymetrics. They include status checking, *timeout systems*, arguments passing and log streaming (+retention in Keymetrics).

E.G.:

```
pmx.scopedAction('long running lsof', function(data, res) {
  var child = spawn('lsof', []);

  child.stdout.on('data', function(chunk) {
    chunk.toString().split('\n').forEach(function(line) {
      res.send(line); // This send log to Keymetrics to be saved (for tracking)
    });
  });

  child.stdout.on('end', function(chunk) {
    res.end('end'); // This end the scoped action
  });

  child.on('error', function(e) {
    res.error(e);  // This report an error to Keymetrics
  });

});
```

## Notify critical errors

This will be displayed in Keymetrics as an Issue and this will trigger an email to the user (with some logic to avoid flood):

```javascript
var pmx = require('pmx');

pmx.notify({ success : false });

pmx.notify('This is an error');

pmx.notify(new Error('This is an error'));
```

## Notify events

Emit events and get historical and statistics. This will be displayed in the event part and allow to track events:

```javascript
var pmx = require('pmx');

pmx.emit('user:register', {
  user : 'Alex registered',
  email : 'thorustor@gmail.com'
});
```

# Writing a module, the basics

## Package.json: Declare options, widget aspect and module behavior

- A package.json must be present with some extra fields like `config` for configuration variables and `apps` to declare the [behavior of this module](https://github.com/Unitech/PM2/blob/master/ADVANCED_README.md#options-1):

```javascript
{
  "name": "pm2-logrotate",  // Used as module name
  "version": "1.0.0",       // Used as module version
  "description": "desc",    // Used as module comment
  "dependencies": {
    "pm2": "latest",
    "pmx": "latest"
  },
  "config": {              // Default configuration value
                           // These values can be modified via Keymetrics or PM2 conf system

     "days_interval" : 7,  // -> returned from var ret = pmx.initModule()
     "max_size" : 5242880  // -> e.g. ret.max_size
  },
  "apps" : [{              // Application configuration
    "merge_logs"         : true,
    "max_memory_restart" : "200M",
    "script"             : "index.js"
  }],
  "author": "Keymetrics Inc.",
  "license": "AGPL-3.0"
}
```

> PM2 will start a file with this priority:
1- script field in apps section
1- bin attritube script
1- main attribute script

## Main Javascript file

The main javascript file (declared below as index.js) will load some informations from the package.json and calling .initModule will notify PM2 that this script is a module:

```javascript
var pmx     = require('pmx');

var conf    = pmx.initModule({

    // Override PID to be monitored (for CPU and Memory blocks)
    pid              : pmx.resolvePidPaths(['/var/run/redis.pid', '/var/run/redis/redis-server.pid']),

    window : {

      // HTML type, if not declared it will fallback to the legacy display
      // Type available: 'generic'
      // Use 'generic' for now as it's the only option available
      type : 'generic',

      // Logo to be displayed on the top left block
      // Must be https
      logo : 'https://image.url',

      // 0 = main element
      // 1 = secondary
      // 2 = main border
      // 3 = secondary border
      // 4 = text color (not implemented yet)
      theme : ['#9F1414', '#591313', 'white', 'white'],

      // Activate horizontal blocks above main widget
      el : {
        probes : false,
        actions: false
      },

      block : {
        // Display remote action block
        actions : true,

        // Display CPU / Memory
        cpu     : true,
        mem     : true,

        // Issues count display
        issues  : true,

        // Display meta block
        meta    : true,

        // Display metadata about the probe (restart nb, interpreter...)
        meta_block : true,

        // Name of custom metrics the more important (like cpu or mem)
        // (for Display purposes)
        main_probes : ['Processes']
      },
    }

    // Status (in the future, not implemented yet)
    status_check : ['latency', 'event loop', 'query/s']
    //= Status Green / Yellow / Red (maybe for probes?)

});
```

# Module Configuration

Configuration value present in the package.json are directly available from the module.
These configuration values can be both modified via PM2 (configuration system) or via Keymetrics.

## Default values

Add default variable values in package.json:

```json
{
 [...]
 "config": {             // Default configuration value
    "days_interval" : 7,  // -> returned from var ret = pmx.initModule()
    "max_size" : 5242880  // -> e.g. ret.max_size
 }
 [...]
}
```

To use them in your code:

```javascript
var conf = pmx.initModule({[...]});

console.log(conf.days_interval);
```

## Override values

```bash
$ pm2 conf module.option [value]
```

OR

```bash
$ pm2 set module_name:option_name <value>
$ pm2 get module_name:option_name <value>
$ pm2 unset module_name:option_name
```

Example:

```bash
$ pm2 set server-monitoring:days_interval 2
```

**NOTE** These variables are written in `~/.pm2/module_conf.json`, so if you prefer, you can directly edit these variables in this file.
**NOTE2** When you set a new value the target module is restarted
**NOTE3** You have to typecase yourself values, they are always strings!


# PMX related methods

## .configureModule

Add/Override a variable to module option (.axm_options)

```javascript
pmx.configureModule({
  new_axm_option : true
});
```

## .getConf()

Get configuration variables for modules (same object than what is returned by pmx.initModule())

## .resolvePidPaths([])

Pass an array of possible pid file path location to be resolved.

# Internal Notes

- Module is set as a pm2 module when started via flag pm2_env.pmx_module
- Same configuration system than npm (config field)
- Keywords: Window > Widget > Blocks
- keywords: view, block, panel, layout, box, widget, layout management, UI layout, container, pane, grid, cells
- Future API draft window management: https://gist.github.com/Unitech/cdb621eaf2dd10769ce7
