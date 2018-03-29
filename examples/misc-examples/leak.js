
var leak = [];

setInterval(function() {
  for (var i = 0; i < 10; i++) {
    var str = i.toString() + " on a stick, short and stout!";
    leak.push(str);
  }
}, 50);
