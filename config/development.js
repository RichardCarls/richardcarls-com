/* jshint node: true */
'use strict';

var path = require('path');

module.exports = {
    site: require(path.resolve(__dirname, './dev/site.js')),
    client: require(path.resolve(__dirname, './dev/client.js')),
    mongoose: require(path.resolve(__dirname, './dev/mongoose.js')),
};
