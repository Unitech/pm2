
var q        = require('./question.js');
var WatchDog = require('../lib/WatchDog.js');
var fs       = require('fs');
var cst      = require('../constants.js');

if (fs.existsSync(cst.WATCHDOG_FILE)) {
  process.exit(0);
}

(function pre_init() {
  fs.exists(cst.DEFAULT_FILE_PATH, function(exist) {
    if (!exist) {
      fs.mkdirSync(cst.DEFAULT_FILE_PATH);
      fs.mkdirSync(cst.DEFAULT_LOG_PATH);
      fs.mkdirSync(cst.DEFAULT_PID_PATH);
    }
  });
})();

var t = setTimeout(function() {
  console.log('Question canceled, you can still enable pm2 monitoring via `pm2 subscribe`');
  WatchDog.refuse();
  process.exit(0);
}, 10000);

q.askOne({ info: 'Would you like to receive an email when pm2 or your server goes offline ? (y/n)', required : false }, function(result){
  clearTimeout(t);

  if (result == 'y' || result == 'Y') {
    q.askOne({ info: 'Email' }, function(email){
      WatchDog.createConfFile(email, function() {
        console.log('Thanks for your subscription, if pm2 goes offline for more that 1min, you will be notified.');
        console.log('\nTo update current pm2 please do :\npm2 updatePM2\n');
      });
    });
  }
  else {
    WatchDog.refuse();
    process.exit(0);
  }
});
