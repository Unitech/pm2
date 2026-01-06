
var obj = {};
var i = 0;

setInterval(function() {
  obj[i] = Array.apply(null, new Array(9999)).map(String.prototype.valueOf,"hi");
  i++;
}, 40);
