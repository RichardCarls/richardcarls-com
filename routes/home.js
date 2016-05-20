var path = require('path');
var router = require('express').Router();

var app = require(path.relative(__dirname, 'app.js'));
var logger = require(path.relative(__dirname, 'lib/logger.js'));

router.get('/', function(req, res) {
  return res.render('home/home.nunj.html', {
    locals: app.locals,
    user: req.user,
  });
});

module.exports = router;
















