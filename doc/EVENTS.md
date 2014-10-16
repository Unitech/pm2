
# Event list emitted by PM2

All events are sent via God.bus.emit (EventEmitter2) then broadcasted to a pub-emitter (pm2-axon).
To retrieve these events you need to connect with pm2-interface to the local PM2.

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

## Event emitted by AXM

These events are emitted via the AXM module (keymetrics/axm) to notify about different kind of actions.
Currently they are sent via process.send (https://github.com/keymetrics/axm/blob/master/lib/utils/transport.js#L9) to PM2 via the IPC channel.

- human:event
- process:exception
- http:transaction
- axm:action
- axm:reply

## Output data

Once broadcasted to the pub-emitter (pm2-axon) each events respect this structure:

Event emitted : event type

Event data:
```
{
  at      : Unix timestamp in second,
  data    : Mixed data,
  process : {
    (all pm2_env keys and values)
  }
}
```
