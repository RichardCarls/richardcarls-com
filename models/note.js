/* jshint node: true */
'use strict';

var path = require('path'),
    logger = require(path.resolve(__dirname, '../lib/logger')),
    mongoose = require('mongoose');


var noteSchema = new mongoose.Schema({
    name: { type: String },
    content: { type: String, },
    published: { type: Date, },
}, {
    toObject: { virtuals: true, },
    toJSON: { virtuals: true, },
});

module.exports = noteSchema;
