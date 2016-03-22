/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
var crypto = require('crypto');

var saltChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
var saltCharsCount = saltChars.length;

function generateSalt(len) {
  if (typeof len != 'number' || len <= 0 || len !== parseInt(len, 10)) throw new Error('Invalid salt length');
  if (crypto.randomBytes) {
    return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').substring(0, len);
  } else {
    for (var i = 0, salt = ''; i < len; i++) {
      salt += saltChars.charAt(Math.floor(Math.random() * saltCharsCount));
    }
    return salt;
  }
}

function generateHash(algorithm, salt, password, iterations) {
  iterations = iterations || 1;
  try {
    var hash = password;
    for(var i=0; i<iterations; ++i) {
      hash = crypto.createHmac(algorithm, salt).update(hash).digest('hex');
    }

    return algorithm + '$' + salt + '$' + iterations + '$' + hash;
  } catch (e) {
    throw new Error('Invalid message digest algorithm');
  }
}

function makeBackwardCompatible(hashedPassword) {
  var parts = hashedPassword.split('$');
  if(parts.length === 3) {
    parts.splice(2,0,1);
    hashedPassword = parts.join("$");
  }

  return hashedPassword;
}

module.exports.generate = function(password, options) {
  if (typeof password != 'string') throw new Error('Invalid password');
  options || (options = {});
  options.algorithm || (options.algorithm = 'sha1');
  options.saltLength || options.saltLength == 0 || (options.saltLength = 8);
  options.iterations || (options.iterations = 1);
  var salt = generateSalt(options.saltLength);
  return generateHash(options.algorithm, salt, password, options.iterations);
};

module.exports.verify = function(password, hashedPassword) {
  if (!password || !hashedPassword) return false;
  hashedPassword = makeBackwardCompatible(hashedPassword);
  var parts = hashedPassword.split('$');
  if (parts.length != 4) return false;
  try {
    return generateHash(parts[0], parts[1], password, parts[2]) == hashedPassword;
  } catch (e) {}
  return false;
};

module.exports.isHashed = function(password) {
  if (!password) return false;
  return password.split('$').length == 4;
}
