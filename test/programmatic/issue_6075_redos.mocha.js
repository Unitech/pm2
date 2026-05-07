
process.chdir(__dirname)

var should = require('should')
var Config = require('../../lib/tools/Config.js')

describe('Issue #6075 / CVE-2025-5891 - Config.js ReDoS', function () {
  this.timeout(5000)

  var sch = { type: ['array', 'string'] }

  it('should split normal args string', function () {
    Config._errors = []
    Config._valid('args', 'arg1 arg2 arg3', sch)
  })

  it('should split quoted args string', function () {
    Config._errors = []
    Config._valid('args', 'key="value" key2=\'value2\'', sch)
  })

  it('should handle adversarial input (100k chars) without hanging', function () {
    var malicious = 'a'.repeat(100000) + '='
    Config._errors = []
    Config._valid('args', malicious, sch)
  })

  it('should handle repeated word-chars with trailing quote without hanging', function () {
    var malicious = 'x-'.repeat(50000) + '"'
    Config._errors = []
    Config._valid('args', malicious, sch)
  })
})
