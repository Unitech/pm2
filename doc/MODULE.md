# Modules system

A PM2 module is basically a NPM module. But this time it's not a library, but a process that will be runned with PM2.

Internally it embeds the NPM install procedure. So a PM2 module will be published to NPM and installed from NPM.

![Process listing](https://github.com/unitech/pm2/raw/master/pres/pm2-module.png)

## Basics

```bash
# INSTALL
$ pm2 install npm-module

# INSTALL GIT
$ pm2 install pm2-hive/pm2-docker

# UNINSTALL
$ pm2 uninstall npm-module

# UPDATE
$ pm2 install npm-module

# INCREMENT AND PUBLISH
$ pm2 publish
```

## Writing a module

### Package.json: Declare meta data, options and module behavior

- A package.json must be present with some extra fields like `config` for configuration variables and `apps` to declare the [behavior of this module](https://github.com/Unitech/PM2/blob/master/ADVANCED_README.md#options-1):

```javascript
{
  "name": "pm2-logrotate", // Used as module name
  "version": "1.0.0",      // Used as module version
  "description": "desc,    // Used as module comment
  "dependencies": {
    "pm2": "latest",
    "pmx": "latest"
  },
  "config": {              // Default configuration value
     "days_interval" : 7,  // -> returned from var ret = pmx.initModule()
    "max_size" : 5242880   // -> e.g. ret.max_size
  },
  "apps" : [{              // Application configuration
    "merge_logs"         : true,
    "max_memory_restart" : "200M",
    "script"             : "index.js"
  }],
  "author": "NA",
  "license": "MIT"
}
```

> Main Script detection is in this order: apps fields > bin attritube > main else fail

### Main Javascript file

The main javascript file (declared below as index.js) will load some informations from the package.json and calling .initModule will notify PM2 that this script is a module:

```javascript
var pmx     = require('pmx');

var conf    = pmx.initModule({

    // Override PID to be monitored (for CPU and Memory blocks)
    pid              : pmx.resolvePidPaths(['/var/run/redis.pid', '/var/run/redis/redis-server.pid']),

    window : {

      // HTML type, if not declared it will fallback to the legacy display
      // Type available: 'generic'
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

      // Activate widget for remotes probes or remote actions
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

        // Display meta block
        meta    : true,
        // Name of custom metrics to be displayed in block style (like cpu or mem)
        main_probes : ['Processes']
      },

      // Status Green / Yellow / Red (maybe for probes?)
    }

});
```

## PMX related methods

### .configureModule

Add new variable to be streamlined in axm_options

```javascript
pmx.configureModule({
  new_axm_option : true
});
```

### .resolvePidPaths([])

Pass an array of possible pid file path location to be resolved.

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

## Module Configuration

### Default values

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
var conf = pmx.initModule();

console.log(conf.days_interval);
```

### Override values

```bash
$ pm2 conf module.option [value]
```

OR

```bash
$ pm2 set module:option_name <value>
$ pm2 get module:option_name <value>
$ pm2 unset module:option_name
```

Example:

```bash
$ pm2 set server-monitoring:days_interval 2
```

**NOTE** These variables are written in `~/.pm2/module_conf.json`, so if you prefer, you can directly edit these variables in this file.
**NOTE2** When you set a new value the target module is restarted

## Thoughts / Notes

- Module is set as a pm2 module when started via flag pm2_env.pmx_module
- Same configuration system than npm (config field)
- Possible to pass a CSS theme to override module display
- Keywords: Window > Widget > Blocks
- keywords: view, block, panel, layout, box, widget, layout management, UI layout, container, pane, grid, cells
- Future API draft window management: https://gist.github.com/Unitech/cdb621eaf2dd10769ce7
