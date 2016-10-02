var path = require('path');
var router = require('express').Router(); // eslint-disable-line new-cap

var app = require(path.resolve(__dirname, '../app'));
var logger = require(path.resolve(__dirname, '../lib/logger.js'));

router.get('/', function(req, res) {
  return res.render('home.nunj.html', {
    site: app.locals.site,
    user: req.user,
    // TODO: Recent Notes
  });
});

module.exports = router;
