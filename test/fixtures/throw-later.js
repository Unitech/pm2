var timer = setInterval(function(){
  console.log('tick', Date.now());
}, 100);

setTimeout(function(){
  clearInterval(timer);
  throw new Error('error has been caught')
}, 350);
