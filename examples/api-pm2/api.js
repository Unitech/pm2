

var pm2 = require('../..');

pm2.delete('all', function(err) {
  if (err) {
    console.error(err);
    return pm2.disconnect();
  }

  pm2.start('http.js', function(err, app) {
    if (err) {
      console.error(err);
      return pm2.disconnect();
    }

    console.log('Process HTTP has been started');

    pm2.restart('http', function(err, app) {
      if (err) {
        console.error(err);
        return pm2.disconnect();
      }

      console.log('Process Restarted');
      return pm2.disconnect();
    });
  });
});
