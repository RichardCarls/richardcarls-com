/* jshint node: true */
'use strict';

var path = require('path');

module.exports = {
    site: require(path.resolve(__dirname, './dev/site')),
    me: require(path.resolve(__dirname, './dev/me')),
    client: require(path.resolve(__dirname, './dev/client')),
    mongoose: require(path.resolve(__dirname, './dev/mongoose')),
    session: require(path.resolve(__dirname, './dev/session')),
};
