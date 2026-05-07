
const pmx = require('../..')

pmx.action({
  name: 'testActionWithConf',
  action: function (reply) { reply({ data: 'testActionWithConfReply' }) }
})
