/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

var fs = require('fs');
var path = require('path');

var dt = fs.readFileSync(path.join(__dirname, 'keymetrics'));

console.log(dt.toString());
