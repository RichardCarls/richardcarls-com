var path = require('path');
var _ = require('lodash');
var Q = require('q');
var logger = require(path.resolve(__dirname, '../lib/logger'));
var router = require('express').Router(); // eslint-disable-line new-cap
var passport = require('passport');
var BearerStrategy = require('passport-http-bearer');
var request = require('request');
var qs = require('querystring');
var micropub = require('connect-micropub');
var webmentions = require('webmentions');
var indieutil = require('@rcarls/indieutil');

var app = require(path.resolve(__dirname, '../app'));
var Note = require(path.resolve(__dirname, '../models/note'));

// TODO: Check error logging (logs the message object)
passport.use(new BearerStrategy({}, function(token, done) {
  return Q.ninvoke(request, 'get', app.locals.site.tokenEndpoint, {
    headers: {
      authorization: 'Bearer ' + token,
    }
  })
    .spread(function(response, body) {
      if (response.statusCode !== 200) {
        logger.warn('Micropub: Token verification failed.');
        throw { message: 'Token verification failed', };
      }

      body = qs.parse(body);

      // Check scope
      var scopes = body.scope.split(' ');
      if (!body.scope || scopes.indexOf('create') === -1 && scopes.indexOf('post') === -1) {
        logger.warn('Micropub: No `create` scope.');
        throw { message: '[create] scope required', };
      }

      // Check client ID
      /*
        if (body.client_id !== app.locals.site.url + '/') {
        return done({ message: 'client not authorized', });
        }
      */

      return qs.parse(body);
    })
    .nodeify(done);
}));

router.post('', [
  passport.authenticate('bearer', { session: false, }),
  micropub.create()
], function(req, res) {
  var jf2 = indieutil.toJf2(req.micropub, {
    compact: false,
    references: false,
  });
  
  var fetchTasks = [];
  // TODO: Fetch all response contexts
  if (!_.isEmpty(jf2['in-reply-to'])) {
    jf2['in-reply-to'].forEach(function(url) {
      var task = indieutil.fetch(url)
          .then(function(mfData) {
            var entry = _.find(mfData.items, { type: ['h-entry'], });
            
            var jf2 = indieutil.toJf2(
              indieutil.entryToCite(entry), {
                preferredContentType: 'text/plain',
                implicitContentType: false,
                compact: false,
                references: false,
              });

            // Determine target post type
            jf2.postTypes = indieutil
              .determinePostTypes(entry);
            
            // Set url if not present
            jf2.url = jf2.url || [url];
            
            // Set accessed
            jf2.accessed = new Date();

            return jf2;
          });

      fetchTasks.push(task);
    });
  }

  Q.all(fetchTasks)
    .then(function(contexts) {
      if (contexts.length) {
        // TODO: Sort contexts into target props
        jf2['in-reply-to'] = contexts;
      }
      
      logger.debug('Micropub JF2', jf2);
      return new Note(jf2).save();
    })
    .then(function(note) {
      logger.info('Created new ' + note.postTypes[0], note.url);
      
      res.location(note.url).status(201).send();

      // Send webmentions
      note.mentions.map(function(context) {
        webmentions.proxyMention({
          source: note.url,
          target: context.url[0],
        }, function(err, data) {
          if (err) { logger.warn(err); return; }

          logger.info(data.message);
        });
      });
    })
    .catch(function(err) {
      logger.error(err);
      
      return res.status(500).send();
    });
});

module.exports = router;
