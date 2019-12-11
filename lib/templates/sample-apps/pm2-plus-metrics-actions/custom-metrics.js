
const io = require('@pm2/io')

// Straight Metric
var user_count = 10

const users = io.metric({
  name: 'CM: Realtime user',
  value: () => {
    return user_count
  }
})

// or users.set(user_count)

// Counter (.inc() .dec())
const currentReq = io.counter({
  name: 'CM: Current Processing',
  type: 'counter'
})

setInterval(() => {
  currentReq.inc()
}, 1000)

// Meter
const reqsec = io.meter({
  name: 'CM: req/sec'
})

setInterval(() => {
  reqsec.mark()
}, 100)


// Histogram
const latency = io.histogram({
  name: 'CM: latency'
});

var latencyValue = 0;

setInterval(() => {
  latencyValue = Math.round(Math.random() * 100);
  latency.update(latencyValue);
}, 100)


////////////////////
// Custom Actions //
////////////////////

io.action('add user', (done) => {
  user_count++
  done({success:true})
})

io.action('remove user', (done) => {
  user_count++
  done({success:true})
})

io.action('with params', (arg, done) => {
  console.log(arg)
  done({success:arg})
})
