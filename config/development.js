/* jshint node: true */
'use strict';

var path = require('path');

module.exports = {
    site: require(path.resolve(__dirname, './dev/site.js')),
    mongoose: require(path.resolve(__dirname, './dev/mongoose.js')),
};
