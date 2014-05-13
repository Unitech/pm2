
var q = require('./question.js');
var WatchDog = require('../lib/WatchDog.js');

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
      });
    });
  }
  else {
    WatchDog.refuse();
    process.exit(0);
  }
});
