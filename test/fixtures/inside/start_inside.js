
var PM2 = require('../../..');

var pm2 = new PM2.custom({
  cwd : __dirname
});

PM2.start('./echo.js', function(err, app) {
  if (err) throw err;
});
