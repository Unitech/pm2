
if (parseInt(process.env.restart_time) === 5) {
  setInterval(function() {
    console.log('Im stable mamen')
  }, 1000)
}
else {
  throw new Error('Ugly error')
}
