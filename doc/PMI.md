
pmi provides deep interaction with PM2/KPM.

- Local PM2 control (RPC)
- Realtime process status info (SUB)

## RPC methods

- `pm2.rpc.prepareJson(json_app, cwd, fn)` send a JSON configuration to start app(s) in the cwd folder
- `pm2.rpc.getMonitorData({}, fn)` receive all related informations about supervised process (cpu/ram/pid...)
- `pm2.rpc.getSystemData({}, fn)` receive all data about process managed by pm2 and computer resources usage
- `pm2.rpc.startProcessId(integer, fn)` start a process by id (pm_id) who his state is stopped
- `pm2.rpc.stopProcessId(integer, fn)` stop a process by id (pm_id)
- `pm2.rpc.stopAll({}, fn)` stop all process
- `pm2.rpc.reload(data, fn)` reload all apps (only for networked apps)
- `pm2.rpc.killMe(data, fn)` kill pm2 daemon
- `pm2.rpc.findByScript(string, fn)` send you back the informations about a specific process
- `pm2.rpc.restartProcessId(integer, fn)` restart a process by id (pm_id)
- `pm2.rpc.restartProcessName(string, fn)` restart all processes who have the given name
- `pm2.rpc.deleteProcess(string, fn)` stop and delete all processes from the pm2 database
- `pm2.rpc.deleteAll(data, fn)` stop and delete all processes
- `pm2.rpc.msgProcess(opts, fn)` send msg `opts.msg` to process at `opts.id` or all processes with `opts.name`

And all others exposed in Satan.JS

## PM2 builtin events

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

## Output data

Once broadcasted to the pub-emitter (pm2-axon) each events respect this structure:

First argument: event type (string)

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

## Full example

```javascript
var pmi = require('pmi');
var pm2 = pmi();

pm2.on('ready', function() {
  console.log('Connected to pm2');

  pm2.bus.on('*', function(event, data){
    console.log(arguments);
  });

  pm2.rpc.getMonitorData({}, function(err, dt) {
    console.log(dt);
  });

  // setTimeout(function() {
  //   pm2.disconnect();
  // }, 2000);
});

pm2.on('reconnecting', function() {
  console.log('Reconnecting to PM2');
});

pm2.on('close', function() {
  console.log('Closing');
});
```

## PMX specific events

- human:event
- process:exception
- http:transaction
- axm:action
- axm:reply

## Disconnect

To naturally exit a process that uses pmi, you need to call the disconnect() method. This will close all connections with PM2/KPM.

> Calling `disconnect()` means "I am entirely done interacting with PM2." You will no longer be able to receive messages on `pm2.bus` or send requests on `pm2.rpc`. To reconnect you must completely start over with a new pm2 object.

## Apache v2 License
