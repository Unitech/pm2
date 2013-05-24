# PM2

The next generation process manager for Node.js.

[![Build Status](https://travis-ci.org/Alexandre-Strzelewicz/PM2.png)](https://travis-ci.org/Alexandre-Strzelewicz/PM2)

- **Rebind env when killed**

# Features

- Clusterize your Node networked script natively
- Monitor process/clustered processes health (status, memory, cpu usage, restarted time) via CLI
- Monitor server health (processes, cpu core...) via JSON api
- Manage your applications configuration via JSON or via CLI
- Forever keep alive process
- Log streaming in realtime
- Builtin log uncaughtException

# Installation

```
npm install -g pm2
```

# Quick start

# Test

```
npm test
```

# A new paradigm

Javascript is single core processing. PM2 bring the creation of multi core JS, very easily.

# Requirements

- Script must be "stateless"
- Node version must be > 0.8
- Doesn't work (not tried) on Win

# Roadmap

- Remote administration via CLI
- Inter process communication channel (message bus)
- Remote require
- Auto start of the script at start (upstart)
- V8 GC memory leak detection
- Monitoring on full time
- Api endpoint benchmark

# License

