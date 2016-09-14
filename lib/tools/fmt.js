// --------------------------------------------------------------------------------------------------------------------
//
// fmt.js - Command line output formatting.
//
// Copyright (c) 2012 Andrew Chilton - http://chilts.org/
// Written by Andrew Chilton <andychilton@gmail.com>
//
// License: http://opensource.org/licenses/MIT
//
// --------------------------------------------------------------------------------------------------------------------

var util = require('util');

// --------------------------------------------------------------------------------------------------------------------

var sep  = '===============================================================================';
var line = '-------------------------------------------------------------------------------';
var field = '                    ';

// --------------------------------------------------------------------------------------------------------------------

// separator
module.exports.separator = function() {
    console.log(sep);
};

// alias the above
module.exports.sep = module.exports.separator;

// line
module.exports.line = function() {
    console.log(line);
};

// title
module.exports.title = function(title) {
    var out = '--- ' + title + ' ';
    out += line.substr(out.length);
    console.log(out);
};

// field
module.exports.field = function(key, value) {
    console.log('' + key + field.substr(key.length) + ' : ' + value);
};

// subfield
module.exports.subfield = function(key, value) {
    console.log('- ' + key + field.substr(key.length + 2) + ' : ' + value);
};

// list item
module.exports.li = function(msg) {
    console.log('* ' + msg);
};

// dump
module.exports.dump = function(data, name) {
    if ( name ) {
        console.log(name + ' :', util.inspect(data, false, null, true));
    }
    else {
        console.log(util.inspect(data, false, null, true));
    }
};

// msg
module.exports.msg = function(msg) {
    console.log(msg);
};

// --------------------------------------------------------------------------------------------------------------------
