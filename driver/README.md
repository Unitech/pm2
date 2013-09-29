# pm2-interface (for pm2 version >= 0.6.0)

pm2-interface permits you to interact with ![PM2](https://github.com/Unitech/pm2) the process manager for NodeJS.

You can **control all exposed methods** by the pm2 deamon ![God](https://github.com/Unitech/pm2/blob/master/lib/God.js) and also **receive real time notifications** for example for a process who got an unexpectedException, who's starting/stopping.

## RPC methods

- `ipm2.rpc.prepare(json, fn)` send a JSON configuration to start app(s)
- `ipm2.rpc.getMonitorData({}, fn)` receive all related informations about supervised process (cpu/ram/pid...)
- `ipm2.rpc.startProcessId(integer, fn)` start a process by id (pm_id) who his state is stopped
- `ipm2.rpc.stopProcessId(integer, fn)` stop a process by id (pm_id)
- `ipm2.rpc.stopAll({}, fn)` stop all process
- `ipm2.rpc.reload(data, fn)` reload all apps (only for networked apps)
- `ipm2.rpc.killMe(data, fn)` kill pm2 daemon
- `ipm2.rpc.findByScript(string, fn)` send you back the informations about a specific process
- `ipm2.rpc.restartProcessId(integer, fn)` restart a process by id (pm_id)
- `ipm2.rpc.restartProcessName(string, fn)` restart all processes who have the given name
- `ipm2.rpc.deleteProcess(string, fn)` stop and delete all processes from the pm2 database
- `ipm2.rpc.deleteAll(data, fn)` stop and delete all processes 

## Notifications

- `process:online` when a process is started/restarted
- `process:exit` when a process is exited
- `process:exception` When a process has received an uncaughtException

**Advanced feature** : You can use `process.emit({ type : 'my:message', data : {}})` in your Node apps. When you emit a message, they will be redirected to pm2 ans send back to the pm2-interface bus.

## Example

```
var ipm2 = require('pm2-interface')();

ipm2.on('ready', function() {
  console.log('Connected to pm2');

  ipm2.bus.on('*', function(event, data){    
    console.log(event, data.pm2_env.name);
  });

  setTimeout(function() {
    ipm2.rpc.restartProcessId(0, function(err, dt) {
      console.log(dt);
    });
  }, 2000);

  
  ipm2.rpc.getMonitorData({}, function(err, dt) {
    console.log(dt);
  });
});
```

## Ideas

- Catching exceptions and fowarding them by mail
- A web interface to control PM2

## Apache v2 License
