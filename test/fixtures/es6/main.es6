
var assert = require('assert');

/**
 * Simple import
 */
import { square, diag } from './lib';

console.log('---- simple export');
console.log(square(11));
console.log(diag(4, 3));


/**
 * Class
 */
import { Person } from './example-class';

var alex = new Person('Alexandre', 'Strzelewicz');

console.log('---- get attribute');

assert.equal(alex.name, 'Alexandre Strzelewicz');

console.log(alex.name);

/**
 * const, let
 */

const dure = 'constant';

// String interpolation
let msg = `Hey ${dure}`;

assert.equal(msg, 'Hey constant');

console.log(msg);

// Multiline

let msg2 = `Hey my name is
${alex.name} and
I eat potatoes`;

console.log(msg2);


// Spread operator

var params = [ "hello", true, 7 ];
var other = [ 1, 2, ...params ]; // [ 1, 2, "hello", true, 7 ]
console.log(other);

var str = "foo";
var chars = [...str ]; // [ "f", "o", "o" ]

console.log(chars);

assert.deepEqual(chars, ['f', 'o', 'o']);

// Extended parameter handling

function f (x, y, ...a) {
  return (x + y) * a.length
}

assert.equal(f(1, 2, "hello", true, 7), 9);

// Destructuring arguments

var list = [ 7, 42 ]
var [ a = 1, b = 2, c = 3, d ] = list
assert.equal(a, 7)
assert.equal(b, 42)
assert.equal(c, 3)
assert.equal(d, undefined);

// Inheritance test

import { Circle } from './inheritance';

var c = new Circle('noun', 10, 20, 30);



setInterval(function() {
}, 1000)
// From
// http://es6-features.org/
