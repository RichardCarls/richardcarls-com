var path = require('path');
var logger = require(path.resolve(__dirname, '../lib/logger'));
var router = require('express').Router(); // eslint-disable-line new-cap
var passport = require('passport');

var app = require(path.resolve(__dirname, '../app'));

router.all('/', passport.authenticate(['indieauth',], {
  successRedirect: '/#successauth',
  failureRedirect: '/#failauth',
}));

router.get('/login',
           passport.authenticate(['indieauth', 'anonymous',]),
           function(req, res) {
             return res.render('auth/login.nunj.html', {
               locals: app.locals,
               user: req.user,
               _csrf: req.csrfToken(),
             });
           });

router.get('/logout', function(req, res) {
  req.session = null;

  return res.redirect('/#logout');
});

module.exports = router;
