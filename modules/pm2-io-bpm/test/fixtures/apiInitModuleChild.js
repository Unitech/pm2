
const pmx = require('../..')

process.env.fixtures = JSON.stringify({
  envVar: 'value',
  password: 'toto'
})

const conf = pmx.initModule({
  test: 'toto'
})
