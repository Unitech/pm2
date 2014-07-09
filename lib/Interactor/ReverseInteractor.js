var ReverseInteract = {
  /**
   * Description
   * @method onMessage
   * @return
   */
  onMessage : function() {
    if (!this.socket) return console.error('Reverse interaction not initialized');
    var self = this;

    this.socket.data('ask', function(raw_msg) {
      debug('ask method done');
      if (process.env.NODE_ENV && process.env.NODE_ENV == 'test') {
        self.socket.send('ask:rep', {
          success : true,
          machine_name : MACHINE_NAME,
          public_key   : PUBLIC_KEY
        });
      } else {
        var ciphered_data = cipherMessage(JSON.stringify({ machine_name : MACHINE_NAME }), SECRET_KEY);
        if (!cipherMessage) return console.error('Got wrong ciphering data %s %s', MACHINE_NAME, SECRET_KEY);
        self.socket.send('ask:rep', {
          data : ciphered_data,
          public_key   : PUBLIC_KEY
        });
      }

    });

    this.socket.data('trigger:action', function(raw_msg) {
      var msg;
      debug('new action received');

      if (process.env.NODE_ENV && process.env.NODE_ENV == 'test')
        msg = raw_msg;
      else
        msg = Cipher.decipherMessage(raw_msg, SECRET_KEY);


      ipm2a.rpc.msgProcess({
        id : msg.process_id,
        msg : msg.action_name
      }, function(err, data) {
        if (err) {
          return self.socket.send('trigger:action:failure', {
            success : false,
            err : err,
            id : msg.process_id,
            action_name : msg.action_name
          });
        }
        console.log('[REVERSE INTERACTOR] Message received from AXM for proc_id : %s and action name %s',
                    msg.process_id, msg.action_name);
        return self.socket.send('trigger:action:success', {
          success : true,
          id : msg.process_id,
          action_name : msg.action_name
        });
      });
    });
  },
  /**
   * Description
   * @method listen
   * @param {} remote_port
   * @param {} remote_host
   * @return
   */
  listen : function(remote_port, remote_host) {
    if (!remote_port || !remote_host) return console.error('Missing parameters');
    var self = this;
    var nssocket = require('nssocket');

    console.log('[REVERSE INTERACTOR] Connecting to %s:%s', remote_host, remote_port);

    this.socket = new nssocket.NsSocket({
      type: 'tcp4'
    });

    this.socket.on('error', function(dt) {
      console.error('[REVERSE INTERACTOR][ERROR]', dt);
    });

    this.socket.on('close', function(dt) {
      console.log('[REVERSE INTERACTOR][CLOSE] connection closed');

      setTimeout(function() {
        self.socket.connect(remote_port, remote_host);
      }, 2000);
    });

    this.socket.on('start', function() {
      console.log('[REVERSE INTERACTOR][START] Reverse connected to %s:%s', remote_host, remote_port);
    });

    self.onMessage();

    this.socket.connect(remote_port, remote_host);
  }
};
