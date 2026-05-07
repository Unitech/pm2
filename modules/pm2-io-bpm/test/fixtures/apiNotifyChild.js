
const pmx = require('../..')

pmx.init()
try {
  throw new Error('myNotify')
} catch (err) {
  pmx.notifyError(err)
}
