
var stop = false;

/**
 * Description
 * @method add
 * @param {} a
 * @param {} b
 * @return sum
 */
function add(a, b) {
  while (a.length < b.length) a.unshift(0);
  while (a.length > b.length) b.unshift(0);
  var carry = 0, sum = []
  for (var i = a.length - 1; i >= 0; i--) {
    var s = a[i] + b[i] + carry;
    if (s >= 10) {
      s = s - 10;
      carry = 1;
    } else {
      carry = 0;
    }
    sum.unshift(s);
  }
  if (carry)
    sum.unshift(carry);
  return sum;
}

/**
 * Description
 * @method fib
 * @param {} n
 * @return CallExpression
 */
function fib(n) {
  var f1 = [0];
  var f2 = [1];

  while (n--) {
    var f3 = add(f1, f2)
    if (stop) return false;
    f1 = f2;
    f2 = f3;
  }
  return f1.join("");
}


var axm = require('axm');

axm.action('load:start', function(reply) {
  fib(50000);
  reply({success : true});
});


axm.action('load:stop', function(reply) {
  stop = true;
  reply({success : true});
});
