var path = require('path');
var logger = require(path.resolve(__dirname, '../lib/logger'));
var router = require('express').Router(); // eslint-disable-line new-cap
var bodyParser = require('body-parser');
var csurf = require('csurf');
var request = require('request');
var _ = require('underscore');

var app = require(path.resolve(__dirname, '../app'));

router.use(bodyParser.urlencoded({ extended: true, }));
router.use(csurf());

router.get('/', function(req, res) {

  return res.render('client/client.nunj.html', {
    locals: app.locals,
    user: req.user,
    _csrf: req.csrfToken(),
  });

});

router.post('/post', function(req, res, next) {
  //logger.debug('client received', req.body);
  
  var endpoint = req.body.endpoint;
  delete req.body.endpoint;

  // Format categories
  req.body.category = req.body.category
    .split(/[\s,]+/);
  
  delete req.body._csrf;

  // Post to user's micropub endpoint
  request.post(req.user.micropub[0], {
    auth: {
      bearer: req.user.token,
    },
    form: req.body,
  }, function(err, response, body) {
    if (err) { return next(err); }

    if (response.statusCode !== 201) {
      return res.redirect(req.baseUrl + '#failed');
    }
    
    return res.redirect(response.headers.location);
  });
});

module.exports = router;
