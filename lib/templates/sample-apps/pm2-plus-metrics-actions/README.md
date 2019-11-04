
# pm2 custom metrics boilerplate

In this boilerplate you will discover a working example of custom metrics feature.

Metrics covered are:
- io.metric
- io.counter
- io.meter
- io.histogram

## What is Custom Metrics?

Custom metrics is a powerfull way to get more visibility from a running application. It will allow you to monitor in realtime the current value of variables, know the number of actions being processed, measure latency and much more.

Once you have plugged in some custom metrics you will be able to monitor their value in realtime with

`pm2 monit`

Or

`pm2 describe`

Or on the PM2+ Web interface

`pm2 open`

## Example

```javascript
const io = require('@pm2/io')

const currentReq = io.counter({
  name: 'CM: Current Processing',
  type: 'counter'
})

setInterval(() => {
  currentReq.inc()
}, 1000)
```

## Documentation

https://doc.pm2.io/en/plus/guide/custom-metrics/
