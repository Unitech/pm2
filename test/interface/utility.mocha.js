
var assert = require('assert');
var Utility = require('../../lib/Utility.js');

describe('Utility', function() {
  describe('.getCanonicModuleName', function () {
    it('should get null without invalid parameters', function() {
      assert(Utility.getCanonicModuleName() === null);
      assert(Utility.getCanonicModuleName(/aa/) === null);
      assert(Utility.getCanonicModuleName(111) === null);
      assert(Utility.getCanonicModuleName({}) === null);
    });

    it('should works with all notation', function() {
      assert(Utility.getCanonicModuleName('ma-zal/pm2-slack') === 'pm2-slack');
      assert(Utility.getCanonicModuleName('pm2-slack@1.0.0') === 'pm2-slack');
      assert(Utility.getCanonicModuleName('pm2-slack-1.0.0.tgz') === 'pm2-slack');
      assert(Utility.getCanonicModuleName('ma-zal/pm2-slack') === 'pm2-slack');
      assert(Utility.getCanonicModuleName('ma-zal/pm2-slack#own-branch') === 'pm2-slack');
      assert(Utility.getCanonicModuleName('pm2-slack') === 'pm2-slack');
      assert(Utility.getCanonicModuleName('@org/pm2-slack') === '@org/pm2-slack');
      assert(Utility.getCanonicModuleName('@org/pm2-slack@latest') === '@org/pm2-slack');
      assert(Utility.getCanonicModuleName('git+https://github.com/user/pm2-slack') === 'pm2-slack');
      assert(Utility.getCanonicModuleName('git+https://github.com/user/pm2-slack.git') === 'pm2-slack');
      assert(Utility.getCanonicModuleName('file:///home/user/pm2-slack') === 'pm2-slack');
      assert(Utility.getCanonicModuleName('file://./pm2-slack') === 'pm2-slack');
      assert(Utility.getCanonicModuleName('file:///home/user/pm2-slack/') === 'pm2-slack');
      assert(Utility.getCanonicModuleName('http-server') === 'http-server');
      assert(Utility.getCanonicModuleName('http://registry.com:12/modules/my-module?test=true') === 'my-module');
      assert(Utility.getCanonicModuleName('http://registry.com:12/modules/http-my-module?test=true') === 'http-my-module');
    });
  });

});
