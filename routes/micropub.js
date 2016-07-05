var path = require('path');
var logger = require(path.resolve(__dirname, '../lib/logger'));
var router = require('express').Router(); // eslint-disable-line new-cap
var passport = require('passport');
var BearerStrategy = require('passport-http-bearer');
var request = require('request');
var qs = require('querystring');
var micropub = require('connect-micropub');

var app = require(path.resolve(__dirname, '../app'));
var Note = require(path.resolve(__dirname, '../models/note.js'));

passport.use(new BearerStrategy({}, function(token, done) {
  request.get(app.locals.site.tokenEndpoint, {
    headers: {
      authorization: 'Bearer ' + token,
    }
  }, function(err, response, body) {
    if (err) {
      logger.error(err);
      return done(err, null);
    }
    
    if (response.statusCode !== 200) {
      return done({ message: 'Token verification failed', });
    }

    body = qs.parse(body);

    // Check scope
    if (!body.scope || body.scope.split(' ').indexOf('create') === -1) {
      return done({ message: '[create] scope required', });
    }

    // Check client ID
    if (body.client_id !== app.locals.site.url + '/') {
      return done({ message: 'client not authorized', });
    }

    return done(null, qs.parse(body));
  });
}));

router.post('', [
  passport.authenticate('bearer', { session: false, }),
  micropub.create()
], function(req, res) {
  logger.debug(req.micropub);

  new Note(req.micropub)
    .save(function(err, note) {
      if (err) {
        logger.error(err);

        return res.status(500).send();
      }

      logger.info('Created new note', note.permalink);

      return res.location(note.permalink).status(201).send();
    });
});

module.exports = router;
