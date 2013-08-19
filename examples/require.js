
var util = require('util');

console.log(util.inspect(require.main));
setInterval(function() {
  console.log(util.inspect(require.main));
}, 8000);


