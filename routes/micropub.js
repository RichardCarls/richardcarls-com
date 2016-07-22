var path = require('path');
var logger = require(path.resolve(__dirname, '../lib/logger'));
var router = require('express').Router(); // eslint-disable-line new-cap
var passport = require('passport');
var BearerStrategy = require('passport-http-bearer');
var request = require('request');
var qs = require('querystring');
var micropub = require('connect-micropub');
var webmentions = require('webmentions');
var indieutil = require('indieutil');

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
    var scopes = body.scope.split(' ');
    if (!body.scope || scopes.indexOf('create') === -1 && scopes.indexOf('post') === -1) {
      return done({ message: '[create] scope required', });
    }

    // Check client ID
    /*
    if (body.client_id !== app.locals.site.url + '/') {
      return done({ message: 'client not authorized', });
    }
    */

    return done(null, qs.parse(body));
  });
}));

router.post('', [
  passport.authenticate('bearer', { session: false, }),
  micropub.create()
], function(req, res) {
  new Note(indieutil.toJf2(req.micropub))  
    .save(function(err, note) {
      if (err) {
        logger.error(err);

        return res.status(500).send();
      }

      logger.info('Created new note', note.url);
      
      res.location(note.url).status(201).send();

      // Send webmentions
      note.mentions.map(function(target) {
        webmentions.proxyMention({
          source: note.url,
          target: target,
        }, function(err, data) {
          if (err) { logger.warn(err); return; }

          logger.info(data.message);
        });
      });
    });
});

module.exports = router;
