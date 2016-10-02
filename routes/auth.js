var path = require('path');
var logger = require(path.resolve(__dirname, '../lib/logger'));
var router = require('express').Router(); // eslint-disable-line new-cap
var bodyParser = require('body-parser');
var passport = require('passport');
var csurf = require('csurf');

var app = require(path.resolve(__dirname, '../app'));

router.use(bodyParser.urlencoded({ extended: true, }));
router.use(csurf());

router.all('/', passport.authenticate(['indieauth',], {
  successRedirect: '/#successauth',
  failureRedirect: '/#failauth',
}));

router.get('/login',
           passport.authenticate(['indieauth', 'anonymous',]),
           function(req, res) {
             return res.render('login-page.nunj.html', {
               site: app.locals.site,
               user: req.user,
               _csrf: req.csrfToken(),
             });
           });

router.get('/logout', function(req, res) {
  req.session = null;

  return res.redirect('/#logout');
});

module.exports = router;
