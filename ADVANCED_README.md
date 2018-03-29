# PM2 production process manager

## Table of contents

### Quick start

- [Installation](#a1)
- [How to update PM2?](#update-pm2)
- [PM2 tab-completion](#tab-completion)
- [Allow PM2 to bind apps on port 80/443 without root](#authbind-pm2)

### Features

- [Transitional state of apps](#a4)
- [Process listing](#a6)
- [Automatic restart process based on memory](#max-memory-restart)
- [Monitoring CPU/Memory usage](#a7)
- [Logs management](#a9)
- [Clustering](#a5)
- [Multiple PM2 on the same server](#multiple-pm2)
- [Watch & Restart](#watch--restart)
- [Reloading without downtime](#hot-reload--0s-reload)
- [Make PM2 restart on server reboot](#a8)
- [JS/JSON app declaration](#jsjson-app-declaration)
  - [Options list](#list-of-all-json-declaration-fields-avaibles)
  - [Schema](#schema)
- [Using PM2 in development](#using-pm2-in-development)
- [Use ES6](#run-next-generation-javascript)

### [Using PM2 in Cloud Providers (Heroku/Google App Engine/Azure)](https://github.com/Unitech/PM2/blob/development/ADVANCED_README.md#using-pm2-in-cloud-providers-1)

- [Without Keymetrics](#without-keymetrics)
- [With Keymetrics](#with-keymetrics)

### Deployment - ecosystem.config.js

- [Getting started with deployment](#deployment)
- [Deployment options](#deployment-help)
- [Considerations](#considerations)
- [Contributing](#deployment-contribution)

### Using PM2 programmatically (via API)

- [Simple example](#programmatic-example)
- [Programmatic API](#programmatic-api)

### Specific

- [Specific features](#a77)
- [Configuration file](#a989)
- [Enabling Harmony ES6](#a66)
- [CoffeeScript](#a19)
- [Testing PM2 on your prod environment](#a149)
- [JSON app via pipe](#a96)

### Knowledge

- [Stateless apps ?](#stateless-apps)
- [Transitional state of apps](#a4)
- [Setup PM2 on server: tutorial](#a89)
- [Logs and PID files](#a34)
- [Execute any script: What is fork mode ?](#a23)

### More

- [Contributing/Development mode](#a27)
- [Known bugs and workaround](#a21)
- [They talk about it](#a20)
- [License](#a15)

------

# Quick start

<a name="a1"/>
## Installation

[Quick Start](http://pm2.keymetrics.io/docs/usage/quick-start/)

<a name="update-pm2"/>
## How to update PM2

[Update PM2](http://pm2.keymetrics.io/docs/usage/quick-start/#how-to-update-pm2)

<a name="tab-completion"/>
## PM2 tab-completion

[Tab-completion for pm2](http://pm2.keymetrics.io/docs/usage/auto-completion/)

# Features

<a name="a4"/>
## Managing applications states

[Process Management](http://pm2.keymetrics.io/docs/usage/process-management/)

<a name="a6"/>
## Process listing

[Process Listing](http://pm2.keymetrics.io/docs/usage/process-management/#process-listing)

<a name="a7"/>
## Monitoring CPU/Memory

[Monitoring](http://pm2.keymetrics.io/docs/usage/monitoring/)

<a name="a5"/>
## Clustering

[Cluster mode](http://pm2.keymetrics.io/docs/usage/cluster-mode/)

### Hot reload / 0s reload

[Reload without Downtime](http://pm2.keymetrics.io/docs/usage/cluster-mode/#reload-without-downtime)

### Graceful reload

[Graceful Reload](http://pm2.keymetrics.io/docs/usage/cluster-mode/#graceful-reload)

<a name="a9"/>
## Logs management

[Log Management](http://pm2.keymetrics.io/docs/usage/log-management/)

<a name="max-memory-restart"/>
## Max Memory Restart

[Max Memory Restart](http://pm2.keymetrics.io/docs/usage/monitoring/#max-memory-restart)

<a name="a8"/>
## Startup script

[Startup Script](http://pm2.keymetrics.io/docs/usage/startup/)

## Multiple PM2 on the same server

[Multiple PM2](http://pm2.keymetrics.io/docs/usage/specifics/#multiple-pm2-on-the-same-server)

## Watch & Restart

[Watch and Restart](http://pm2.keymetrics.io/docs/usage/watch-and-restart/)

## JS/JSON app declaration

[Application Declaration](http://pm2.keymetrics.io/docs/usage/application-declaration/)

## Using PM2 in development

[PM2 in Development](http://pm2.keymetrics.io/docs/usage/pm2-development/)

## Run Next generation Javascript

[Run ES6](http://pm2.keymetrics.io/docs/usage/specifics/#enabling-harmony-es6)

# Using PM2 in Cloud Providers

[Using PM2 with PaaS](http://pm2.keymetrics.io/docs/usage/use-pm2-with-cloud-providers/)

<a name="deployment"/>
# Deployment

[Deployment](http://pm2.keymetrics.io/docs/usage/deployment/)

<a name="programmatic-example"/>
# Using PM2 programmatically

[PM2 API](http://pm2.keymetrics.io/docs/usage/pm2-api/)

<a name="a77"/>
# Special features

[Specifics](http://pm2.keymetrics.io/docs/usage/specifics/)

<a name="a66"/>
## Enabling Harmony ES6

[Specifics](http://pm2.keymetrics.io/docs/usage/specifics/)

<a name="a19"/>
## CoffeeScript

[Specifics](http://pm2.keymetrics.io/docs/usage/specifics/)

# Knowledge

[Knowledge](http://pm2.keymetrics.io/docs/usage/knowledge/)

# Contributing

[Contributing](http://pm2.keymetrics.io/docs/usage/contributing/)

### User tips from issues
- [Vagrant and pm2 #289](https://github.com/Unitech/pm2/issues/289#issuecomment-42900019)
- [Start the same app on different ports #322](https://github.com/Unitech/pm2/issues/322#issuecomment-46792733)
- [Using ansible with pm2](https://github.com/Unitech/pm2/issues/88#issuecomment-49106686)
- [Cron string as argument](https://github.com/Unitech/pm2/issues/496#issuecomment-49323861)
- [Restart when process reaches a specific memory amount](https://github.com/Unitech/pm2/issues/141)
- [Sticky sessions and socket.io discussion](https://github.com/Unitech/PM2/issues/637)
- [EACCESS - understanding pm2 user/root rights](https://github.com/Unitech/PM2/issues/837)

<a name="a20"/>
## External resources and articles

- [Goodbye node-forever, hello pm2](http://devo.ps/blog/goodbye-node-forever-hello-pm2/)
- [https://serversforhackers.com/editions/2014/11/04/pm2/](https://serversforhackers.com/editions/2014/11/04/pm2/)
- http://www.allaboutghost.com/keep-ghost-running-with-pm2/
- http://blog.ponyfoo.com/2013/09/19/deploying-node-apps-to-aws-using-grunt
- http://www.allaboutghost.com/keep-ghost-running-with-pm2/
- http://bioselemental.com/keeping-ghost-alive-with-pm2/
- http://blog.chyld.net/installing-ghost-on-ubuntu-13-10-aws-ec2-instance-with-pm2/
- http://blog.marvinroger.fr/gerer-ses-applications-node-en-production-pm2/
- https://www.codersgrid.com/2013/06/29/pm2-process-manager-for-node-js/
- http://www.z-car.com/blog/programming/how-to-rotate-logs-using-pm2-process-manager-for-node-js
- http://yosoftware.com/blog/7-tips-for-a-node-js/
- https://www.exponential.io/blog/nodeday-2014-moving-a-large-developer-workforce-to-nodejs
- http://blog.rapsli.ch/posts/2013/2013-10-17-node-monitor-pm2.html
- https://coderwall.com/p/igdqyw
- http://revdancatt.com/2013/09/17/node-day-1-getting-the-server-installing-node-and-pm2/
- https://medium.com/tech-talk/e7c0b0e5ce3c

## Contributors

[Contributors](http://pm2.keymetrics.io/hall-of-fame/)

## Sponsors

Thanks to [Devo.ps](http://devo.ps/) and [Wiredcraft](http://wiredcraft.com/) for their knowledge and expertise.

<a name="a15"/>
# License

Files in `lib/` are made available under the terms of the GNU Affero General Public License 3.0 (AGPL 3.0).
Except the file `lib/CLI.js` who is made under the terms of the Apache V2 license.
