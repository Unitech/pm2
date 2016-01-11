
# PM2 configuration system

## Current configurable values

process.env.KEYMETRICS_NODE || 'root.keymetrics.io'
process.env.KEYMETRICS_PUSH_PORT
process.env.KEYMETRICS_REVERSE_PORT
process.env.PM2_WORKER_INTERVAL
process.env.PM2_KILL_TIMEOUT
process.env.PM2_GRACEFUL_TIMEOUT
process.env.PM2_GRACEFUL_LISTEN_TIMEOUT
process.env.PM2_CONCURRENT_ACTIONS
process.env.PM2_API_PORT
process.env.PM2_DEBUG

## Goal

Allow to configure pm2 via pm2 configuration system
