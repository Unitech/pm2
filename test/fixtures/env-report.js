var fs = require('fs')
var path = require('path')

var objectKeys = Object.keys(process.env).filter(function (k) {
  return process.env[k] === '[object Object]'
})

var report = JSON.stringify({ object_keys: objectKeys })
fs.writeFileSync(path.join(__dirname, '..', 'env-report-result.json'), report)

setInterval(function () {}, 1000)
