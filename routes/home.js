/* jshint node: true */
'use strict';

var path = require('path'),
    router = require('express').Router();

var app = require(path.relative(__dirname, 'app.js')),
    logger = require(path.relative(__dirname, 'lib/logger.js'));


router.get('/', function(req, res) {
    return res.render('home/home.nunj.html', app.locals);
});

module.exports = router;
















