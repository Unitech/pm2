
var crypto = require('crypto');

const CIPHER_ALGORITHM = 'aes256';

var Cipher = module.exports = {};

/**
 * Description
 * @method decipherMessage
 * @param {} msg
 * @return ret
 */
Cipher.decipherMessage = function(msg, key) {
  var ret = {};

  try {
    var decipher = crypto.createDecipher(CIPHER_ALGORITHM, key);
    var decipheredMessage = decipher.update(msg, 'hex', 'utf8');
    decipheredMessage += decipher.final('utf8');
    ret = JSON.parse(decipheredMessage);
  } catch(e) {
    return null;
  }

  return ret;
}

/**
 * Description
 * @method cipherMessage
 * @param {} data
 * @param {} key
 * @return
 */
Cipher.cipherMessage = function(data, key) {
  try {
    var cipher       = crypto.createCipher(CIPHER_ALGORITHM, key);
    var cipheredData = cipher.update(data, 'utf8', 'hex');
    cipheredData += cipher.final('hex');
    return cipheredData;
  } catch(e) {
    return null;
  }
}
