/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

var debug          = require('debug')('interface:driver');
var Cipher         = require('../Cipher.js');

var CustomActions = module.exports = {
  /**
   * Method to trigger custom actions (axm actions)
   */
  axmCustomActions : function() {
    var self = this;

    this.socket.data('trigger:action', function(raw_msg) {
      var msg = {};

      if (process.env.NODE_ENV && (process.env.NODE_ENV == 'test' ||
                                   process.env.NODE_ENV == 'local_test'))
        msg = raw_msg;
      else
        msg = Cipher.decipherMessage(raw_msg, self.conf.SECRET_KEY);

      if (!msg) return console.error('Error while receiving message! #axmCustomActions');

      console.log('New remote action %s triggered for process %s', msg.action_name, msg.process_id);
      self.pm2_instance.msgProcess({
        id  : msg.process_id,
        msg : msg.action_name,
        opts: msg.opts || null
      }, function(err, data) {
        if (err) {
          return self.socket.send('trigger:action:failure', {
            success     : false,
            err         : err.message,
            id          : msg.process_id,
            action_name : msg.action_name
          });
        }
        console.log('[REVERSE INTERACTOR] Message received from AXM for proc_id : %s and action name %s',
                    msg.process_id, msg.action_name);

        return self.socket.send('trigger:action:success', {
          success     : true,
          id          : msg.process_id,
          action_name : msg.action_name
        });
      });
    });

    this.socket.data('trigger:scoped_action', function(raw_msg) {
      var msg = {};

      if (process.env.NODE_ENV && (process.env.NODE_ENV == 'test' ||
                                   process.env.NODE_ENV == 'local_test'))
        msg = raw_msg;
      else
        msg = Cipher.decipherMessage(raw_msg, self.conf.SECRET_KEY);

      if (!msg) return console.error('Error while receiving message! #axmCustomActions');

      console.log('New SCOPED action %s triggered for process %s', msg.action_name, msg.process.pm_id);

      self.pm2_instance.msgProcess({
        id          : msg.process.pm_id,
        action_name : msg.action_name,
        msg         : msg.action_name,
        opts        : msg.options || {},
        uuid        : msg.uuid
      }, function(err, data) {
        if (err) {
          return self.socket.send('trigger:action:failure', {
            success     : false,
            err         : err.message,
            id          : msg.process.pm_id,
            action_name : msg.action_name
          });
        }
        console.log('[REVERSE INTERACTOR] Message received from AXM for proc_id : %s and action name %s',
                    msg.process_id, msg.action_name);

        return self.socket.send('trigger:action:success', {
          success     : true,
          id          : msg.process.pm_id,
          action_name : msg.action_name
        });
      });
    });
  }
};
