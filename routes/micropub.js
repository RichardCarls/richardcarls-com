/* jshint node: true */
'use strict';

var path = require('path'),
    logger = require(path.resolve(__dirname, '../lib/logger')),
    micropub = require('micropub-express'),
    router = require('express').Router();

var mongoose = require('mongoose'),
    Note = mongoose.model('Note');

router.use('/', micropub({
    tokenReference: {
	me: 'https://dev.richardcarls.com:3443',
	endpoint: 'https://tokens.indieauth.com/token',
    },
    handler: function(mpData, req) {
	return Promise.resolve()
	    .then(function() {
		return { url: 'https://dev.richardcarls.com:3443/notes/1' };
	    });
    },
}));

module.exports = router;
