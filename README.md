[![PM2](https://github.com/unitech/pm2/raw/master/pres/pm2.20d3ef.png)](http://pm2.keymetrics.io)

**P**(rocess) **M**(anager) **2**

PM2 is a production process manager for Node.js applications with a built-in load balancer. It allows you to keep applications alive forever, to reload them without downtime and to facilitate common system admin tasks.

Starting an application in production mode is as easy as:

```bash
$ pm2 start app.js
```

PM2 is constantly assailed by [more than 700 tests](https://travis-ci.org/Unitech/pm2).

Official website: [http://pm2.keymetrics.io](http://pm2.keymetrics.io)

Works on Linux (stable) & MacOSx (stable) & Windows (bêta).

[![Version npm](https://img.shields.io/npm/v/pm2.svg?style=flat-square)](https://www.npmjs.com/package/pm2)[![NPM Downloads](https://img.shields.io/npm/dm/pm2.svg?style=flat-square)](https://www.npmjs.com/package/pm2)[![Build Status](https://travis-ci.org/Unitech/pm2.svg?branch=master)](https://travis-ci.org/Unitech/pm2)

[![NPM](https://nodei.co/npm/pm2.png?downloads=true&downloadRank=true)](https://nodei.co/npm/pm2/)

## Install PM2

```bash
$ npm install pm2 -g
```

*npm is a builtin CLI when you install Node.js - [Installing Node.js with NVM](https://keymetrics.io/2015/02/03/installing-node-js-and-io-js-with-nvm/)*

## Start an application

```bash
$ pm2 start app.js
```

Your app is now put in background, monitored and kept alive forever.

[More about Process Management](http://pm2.keymetrics.io/docs/usage/quick-start/#cheat-sheet)

## Module system

PM2 embeds a simple and powerful module system. Installing a module is straightforward:

```bash
$ pm2 install <module_name>
```

Here are some PM2 compatible modules (standalone Node.js applications managed by PM2):

[**pm2-logrotate**](https://github.com/pm2-hive/pm2-logrotate) auto rotate logs of PM2 and applications managed<br/>
[**pm2-webshell**](https://github.com/pm2-hive/pm2-webshell) expose a fully capable terminal in browsers<br/>
[**pm2-autopull**](https://github.com/pm2-hive/pm2-auto-pull) auto pull all applications managed by PM2<br/>

[How to write a module](http://pm2.keymetrics.io/docs/advanced/pm2-module-system/)

## Update PM2

```bash
# Install latest pm2 version
$ npm install pm2 -g
# Save process list, exit old PM2 & restore all processes
$ pm2 update
```

*PM2 updates are seamless*

## Main features

### Process management

Once apps are started you can list and manage them easily:

![Process listing](https://github.com/unitech/pm2/raw/master/pres/pm2-list.png)

Listing all running processes:

```bash
$ pm2 list
```

Managing your processes is straightforward:

```bash
$ pm2 stop     <app_name|id|'all'|json_conf>
$ pm2 restart  <app_name|id|'all'|json_conf>
$ pm2 delete   <app_name|id|'all'|json_conf>
```

To have more details on a specific process:

```bash
$ pm2 describe <id|app_name>
```

[More about Process Management](http://pm2.keymetrics.io/docs/usage/quick-start/#cheat-sheet)

### Load balancing / 0s reload downtime

When an app is started with the -i <worker number> option, the **cluster** mode is enabled.

Supported by all major Node.js frameworks and any Node.js applications

![Framework supported](https://raw.githubusercontent.com/Unitech/PM2/development/pres/cluster-support.png)

**Warning**: If you want to use the embedded load balancer (cluster mode), we recommend the use of `node#0.12.0+` or `node#0.11.16+`. We do not support `node#0.10.*`'s cluster module anymore.

With the cluster mode, PM2 enables load balancing between multiple application to use all CPUs available in a server.
Each HTTP/TCP/UDP request will be forwarded to one specific process at a time.

```bash
$ pm2 start app.js -i 0  # Enable load-balancer and cluster features

$ pm2 reload all           # Reload all apps in 0s manner

$ pm2 scale <app_name> <instance_number> # Increase / Decrease process number
```

[More informations about how PM2 make clustering easy](https://keymetrics.io/2015/03/26/pm2-clustering-made-easy/)

### CPU / Memory Monitoring

![Monit](https://github.com/unitech/pm2/raw/master/pres/pm2-monit.png)

Monitoring all processes launched:

```bash
$ pm2 monit
```

### Log facilities

![Monit](https://github.com/unitech/pm2/raw/master/pres/pm2-logs.png)

Displaying logs of a specified process or all processes, in real time:

`pm2 logs ['all'|'PM2'|app_name|app_id] [--err|--out] [--lines <n>] [--raw] [--timestamp [format]]`

Examples:

```bash
$ pm2 logs
$ pm2 logs WEB-API --err
$ pm2 logs all --raw
$ pm2 logs --lines 5
$ pm2 logs --timestamp "HH:mm:ss"
$ pm2 logs WEB-API --lines 0 --timestamp "HH:mm" --out
$ pm2 logs PM2 --timestamp

$ pm2 flush          # Clear all the logs
```

[More about log management](http://pm2.keymetrics.io/docs/usage/log-management/)

### Startup script generation

PM2 can generate and configure a startup script to keep PM2 and your processes alive at every server restart.  Execute the startup command only as the user to be running the PM2 daemon.

```bash
$ pm2 startup
# auto-detect platform
$ pm2 startup [platform]
# render startup-script for a specific platform, the [platform] could be one of:
#   ubuntu|centos|redhat|gentoo|systemd|darwin|amazon
```

To save a process list just do:

```bash
$ pm2 save
```

[More about startup scripts](http://pm2.keymetrics.io/docs/usage/startup/)

### Development mode

PM2 comes with a development tool that allow you to start an application and restart it on file change.

```
# Start your application in development mode
# = Print the logs and restart on file change
$ pm2-dev run my-app.js
```

## Keymetrics monitoring

[![Keymetrics Dashboard](https://keymetrics.io/assets/images/application-demo.png)](https://app.keymetrics.io/#/register)

If you manage your NodeJS app with PM2, Keymetrics makes it easy to monitor and manage apps across servers.
Feel free to try it:

[Discover the monitoring dashboard for PM2](https://app.keymetrics.io/#/register)

Thanks in advance and we hope that you like PM2!

## More about PM2

- [Watch & Restart](http://pm2.keymetrics.io/docs/usage/watch-and-restart/)
- [Application Declaration via JS files](http://pm2.keymetrics.io/docs/usage/application-declaration/)
- [PM2 API](http://pm2.keymetrics.io/docs/usage/pm2-api/)
- [Deploying workflow](http://pm2.keymetrics.io/docs/usage/deployment/)
- [PM2 and Heroku/Azure/App Engine](http://pm2.keymetrics.io/docs/usage/use-pm2-with-cloud-providers/)
- [PM2 auto completion](http://pm2.keymetrics.io/docs/usage/auto-completion/)

## CHANGELOG

[CHANGELOG](https://github.com/Unitech/PM2/blob/master/CHANGELOG.md)

## Contributors

[Contributors](http://pm2.keymetrics.io/hall-of-fame/)

## License

PM2 is made available under the terms of the GNU Affero General Public License 3.0 (AGPL 3.0).
For other license [contact us](https://keymetrics.io/contact/).

[![Analytics](https://ga-beacon.appspot.com/UA-51734350-4/Unitech/pm2?pixel)](https://github.com/Unitech/pm2)
