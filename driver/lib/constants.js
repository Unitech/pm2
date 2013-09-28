//
// Modifying these values break tests and can break
// pm2-interface intercommunication (because of ports)
//

module.exports = {
  DAEMON_BIND_HOST   : 'localhost',
  DAEMON_RPC_PORT    : 6666, // RPC commands
  DAEMON_PUB_PORT    : 6667, // Realtime events
  SUCCESS_EXIT       : 0,
  ERROR_EXIT         : 1
};
