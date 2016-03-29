/* jshint node: true */
'use strict';

var path = require('path'),
    logger = require(path.resolve(__dirname, '../lib/logger')),
    router = require('express').Router();

var app = require(path.resolve(__dirname, '../app'));


router.get('/', function(req, res) {
    return res.render('client/client.nunj.html', app.locals);
});

router.post('/post', function(req, res) {
    logger.debug('Got micropub post data', req.body);
    
    return res.status(400).send('Not implemented');
});

module.exports = router;
