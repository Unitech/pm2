const pmx = require('../..')

pmx.action('testAction', function (reply) {
  reply({ data: 'testActionReply' })
})
