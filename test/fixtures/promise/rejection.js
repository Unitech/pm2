
setTimeout(function() {
  Promise.reject(new Error('Errorla'));
}, 1000);

setInterval(function() {
}, 1000);
