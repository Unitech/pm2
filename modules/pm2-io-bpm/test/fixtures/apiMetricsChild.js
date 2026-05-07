
const io = require('../..')
const { MetricType } = require('../../services/metrics')

const [ one, two, three ] = io.metrics(
  [
    {
      name: 'metricHistogram',
      type: MetricType.histogram,
      id: 'metric/custom'
    },
    {
      name: 'metric with spaces',
      type: MetricType.histogram,
      id: 'metric/custom'
    },
    {
      name: 'metric wi!th special chars % ///',
      type: MetricType.histogram,
      id: 'metric/custom'
    }
  ]
)

one.update(10)

// test inline declaration
const metric = io.metric('metricInline')
metric.set(11)

io.metric({
  name: 'toto',
  value: () => 42
})

// set something into event loop. Else test will exit immediately
const timer = setInterval(function () {
  return
}, 5000)

process.on('SIGINT', function () {
  clearInterval(timer)
  io.destroy()
})
