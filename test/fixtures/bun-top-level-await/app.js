await new Promise((resolve) => setTimeout(resolve, 10));

console.log('bun-top-level-await-ok');

setInterval(function () {}, 1000);
