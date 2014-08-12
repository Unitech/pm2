# pm2-interface (for pm2 version >= 0.6.0)

pm2-interface permits you to interact with [PM2](https://github.com/Unitech/pm2) the process manager for NodeJS.

You can **control all exposed methods** by the pm2 deamon [God](https://github.com/Unitech/pm2/blob/master/lib/God.js) and also **receive real time notifications** for example for a process who got an unexpectedException, who's starting/stopping.

## RPC methods

- `ipm2.rpc.prepareJson(json_app, cwd, fn)` send a JSON configuration to start app(s) in the cwd folder
- `ipm2.rpc.getMonitorData({}, fn)` receive all related informations about supervised process (cpu/ram/pid...)
- `ipm2.rpc.getSystemData({}, fn)` receive all data about process managed by pm2 and computer resources usage
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
- `ipm2.rpc.msgProcess(opts, fn)` send msg `opts.msg` to process at `opts.id` or all processes with `opts.name`

## Notifications

- `process:online` when a process is started/restarted
- `process:exit` when a process is exited
- `process:exception` When a process has received an uncaughtException

**Advanced feature** : You can use `process.send({ type : 'my:message', data : {}})` in your Node apps. When you emit a message, they will be redirected to pm2 and sent back to the pm2-interface bus. This can be coupled with `rpc.msgProcess(opts, fn)` to allow 2-way communication between managed processes and pm2-interface - see second Example below.

> It should be noted that `process.send` will be undefined if there is no parent process. Therefore a check of `if (process.send)` may be advisable.

## Example

```javascript
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

## Example 2-way

in your process script
```javascript
if (send in process) {
  process.on("message", function (msg) {
    if ( "type" in msg && msg.type === "god:heap" ) {
        var heap = process.memoryUsage().heapUsed
      process.send({type:"process:heap", heap:heap})
    }
  })
}

var myMemoryLeak = []

setInterval( function () {
  var object = {}
  for (var i = 0; i < 10000; i++) {
    object["key"+i] = Math.random().toString(36).substring(7)
  }

  myMemoryLeak.push(object)

}, Math.round(Math.random()*2000))
```
in monitoring script
```javascript
var ipm2 = require('pm2-interface')()

ipm2.on('ready', function() {

    console.log('Connected to pm2')

    ipm2.bus.on('process:heap', function(data){
        console.log("process heap:", data)
    })


    setInterval( function () {
        var msg = {type:"god:heap"}   // god: is arbitrary and used to distinguish incoming & outgoing msgs
        ipm2.rpc.msgProcess({name:"worker", msg:msg}, function (err, res) {
            if (err) console.log(err)
            else console.log(res)
        })
    }, 5000)
})
```
Start pm2 and monitoring script + output:
```shell
pm2 start worker.js -i 3 --name worker
node monitor.js

sent 3 messages   # coming from the console.log(res)
process heap: { pm_id: 0, msg: { type: 'process:heap', heap: 43416064 } }
process heap: { pm_id: 1, msg: { type: 'process:heap', heap: 18373704 } }
process heap: { pm_id: 2, msg: { type: 'process:heap', heap: 80734256 } }
sent 3 messages
process heap: { pm_id: 0, msg: { type: 'process:heap', heap: 61994096 } }
process heap: { pm_id: 1, msg: { type: 'process:heap', heap: 22437400 } }
process heap: { pm_id: 2, msg: { type: 'process:heap', heap: 116622432 } }
sent 3 messages
process heap: { pm_id: 0, msg: { type: 'process:heap', heap: 79641168 } }
process heap: { pm_id: 1, msg: { type: 'process:heap', heap: 32260112 } }
process heap: { pm_id: 2, msg: { type: 'process:heap', heap: 156047904 } }

pm2 delete all
```

## Disconnect

Since pm2-interface interacts with PM2 via sockets, any script which uses pm2-interface will remain alive even when the node.js event loop is empty. `process.exit()` can be called to forcefully exit, or, if your script has finished making calls to PM2, you may call `ipm2.disconnect()` to disconnect the socket connections and allow node to exit automatically.

```javascript
ipm2.on('ready', function() {

  // ...

  ipm2.disconnect();
});
```

> Calling `disconnect()` means "I am entirely done interacting with PM2." You will no longer be able to receive messages on `ipm2.bus` or send requests on `ipm2.rpc`. To reconnect you must completely start over with a new ipm2 object.

## Ideas

- Catching exceptions and fowarding them by mail
- A web interface to control PM2

## Apache v2 License
