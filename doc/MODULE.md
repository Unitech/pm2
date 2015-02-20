
# Modules system

A PM2 module is basically a NPM module. But this time it's not a library, but a process that will be run with PM2.

Internally it embeds the NPM install procedure. So a PM2 module will be published to NPM and installed from NPM.

![Process listing](https://github.com/unitech/pm2/raw/poc-plugin/pres/pm2-module.png)

## Basics

```bash
$ pm2 install module-probe
$ pm2 uninstall module-probe
```

## Configuration

```bash
$ pm2 set <key> <value>
$ pm2 unset <key>
```

The key will become an environment variable accesible inside the module

E.g.

```bash
$ pm2 set pmx_timeout value
```

```javascript
console.log(process.env.pmx_timeout);
```

## Writing a module

**THE API IS STILL UNDER INSPECTION**

A module is a classic NPM module that contains at least these files:
- **package.json** with all dependencies needed to run this module and the app to be run
- **index.js** a script that init the module and do whatever you need

Publishing a module consist of doing:

```bash
$ npm publish
```

## Development workflow

A workflow is available to easily develop new modules:

```bash
$ pm2 install .
$ pm2 logs
$ pm2 uninstall .
```

- Every time an update is made the module will be automatically restarted
- Use pm2 logs to see how your app behaves
- To debug what is send to pm2 just set the variable

```
process.env.MODULE_DEBUG = true;
```

## Pre flight checks

- in the package.json this must be present in order to launch the app:

```json
  [...]
  "apps" : [{
    "script" : "probe.js"
  }]
  [...]
```

- Here is a boilerplate for the main file that will be runned:

```javascript
var pmx     = require('pmx');

// Load confjs file and init module as PM2 module
var conf    = pmx.loadConfig();
```

**internals.pid** allows you to monitor a specific PID instead of the PID of the current process.

**internals.errors|latency|versioning|show_module_meta** allows you to show or hide panel in the keymetrics dashboard.

**internals.name|comment** allows you to display some metadata in keymetrics

## Internals

### Start

1- When a plugin is installed, it does an npm install and move it to .pm2/node_modules/module-name
1- Then the package.json is started with watch option, forced name (= name folder) and started as module

-> pm2_env.pmx_module flag is set to true. Allows to differenciate it from other classic processes

### loadConfig()

1- send conf.internals to PM2 with msg type axm:option:configuration
1- Attach this data to pm2_env.axm_options

1- pm2_env.axm_options for the values of the probes
