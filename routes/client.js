var path = require('path');
var logger = require(path.resolve(__dirname, '../lib/logger'));
var router = require('express').Router(); // eslint-disable-line new-cap

var app = require(path.resolve(__dirname, '../app'));

router.get('/', function(req, res) {

  return res.render('client/client.nunj.html', {
    locals: app.locals,
    user: req.user,
    _csrf: req.csrfToken(),
  });

});

router.post('/post', function(req, res) {
  logger.debug('User session', req.user);
  logger.debug('Got micropub post data', req.body);

  return res.status(400).send('Not implemented');
});

module.exports = router;
