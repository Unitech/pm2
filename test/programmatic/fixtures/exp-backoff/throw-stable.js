
if (parseInt(process.env.restart_time) === 5) {
  return setInterval(function() {
    console.log('Im stable mamen')
  }, 1000)
}

throw new Error('Ugly error')
