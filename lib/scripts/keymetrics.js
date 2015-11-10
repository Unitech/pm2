
var fs = require('fs');
var path = require('path');

var dt = fs.readFileSync(path.join(__dirname, 'keymetrics'));

console.log(dt.toString());
