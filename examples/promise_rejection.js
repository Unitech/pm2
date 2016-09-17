var p = new Promise(function(resolve, reject) {
  throw new Error('fail')
  return resolve('ok')
})

p.then(function(e) {
})
