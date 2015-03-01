
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

> If this is not present in the package.json it will try to get the first binary (bin attr), if it's not present it will start the file declared as the index.js else it will fail.

- Here is a boilerplate for the main file that will be runned:

```javascript
var pmx     = require('pmx');

// Load confjs file and init module as PM2 module
var conf    = pmx.initModule();
```

An object can be passed to initModule:

```json
{
    errors           : false,
    latency          : false,
    versioning       : false,
    show_module_meta : false
    pid              : pid_number (overidde pid to monitor // use pmx.getPID(FILE)),
    comment          : string (comment to be displayed in dashboard)
}
```

## Internals

### Start

1- When a plugin is installed, it does an npm install and move it to .pm2/node_modules/module-name
-> pm2_env.pmx_module flag is set to true. Allows to differenciate it from other classic processes
