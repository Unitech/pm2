
const pmx = require('../..')

const Koa = require('koa')
const app = new Koa()

app.use(pmx.koaErrorHandler())

app.use(async ctx => {
  ctx.throw(new Error('toto'))
})

pmx.onExit(() => {
  pmx.destroy()
})

app.listen(3003, () => {
  if (typeof process.send === 'function') {
    process.send('ready')
  }
})
