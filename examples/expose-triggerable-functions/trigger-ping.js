var pm2 = require('../..');

pm2.trigger('0', 'ping', function(err, res) {
  var rep_1 = res[0];
  console.log(`Got result from ${rep_1.process.name}`);
  console.log(rep_1.data);

  pm2.disconnect();
});
