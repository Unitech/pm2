
/*
 * Example of usage : https://github.com/Unitech/pm2/pull/214
 */
process.on("message", function (msg) {
  console.log('got message', msg);
  if ( "type" in msg && msg.type === "god:heap" ) {
    var heap = process.memoryUsage().heapUsed;
    process.send({type:"process:heap", heap:heap});
  }
});
