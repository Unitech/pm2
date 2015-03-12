
# PM2 Programmatic usage

PM2 can be installed as a module and used programmatically.
The interface allows:

- Local PM2 control (RPC)(same commands than CLI)
- Realtime process status info (BUS)

## RPC system - remote control

All CLI commands can be called by requiring and connecting to pm2:

```javascript
var pm2 = require('pm2');

pm2.connect(function() {
  pm2.start('examples/echo.js', function() {
    setInterval(function() {
      pm2.restart('echo', function() {
      });
    }, 2000);
  });
});
```

### Disconnecting from RPC

```javascript
pm2.disconnect();
```

## Bus system - event monitoring

```javascript
var pm2 = require('pm2');

pm2.launchBus(function(err, bus) {
  console.log('connected', bus);

  bus.on('log:out', function(data) {
    console.log(arguments);
  });

  bus.on('reconnect attempt', function() {
    console.log('Bus reconnecting');
  });

  bus.on('close', function() {
    console.log('Bus closed');
  });
});
```

### Disconnecting from Bus

```javascript
pm2.disconnectBus();
```

### Subscribable events

- process:exception
- log:err
- log:out
- pm2:kill

- process:event
    - restart
    - delete
    - stop
    - restart overlimit
    - exit
    - start
    - online

### Event data structure

The data received for events are structured like that:

First argument : event type (string)
Second argument: data (object)

```json
{
  at      : Unix timestamp in second,
  data    : Mixed data,
  process : {
    (all pm2_env keys and values)
  }
}
```

### PMX specific events

- human:event
- process:exception
- http:transaction
- axm:action
- axm:reply

## lib/CLI.js is under Apache v2 License
