var path = require('path');
var logger = require(path.resolve(__dirname, '../lib/logger'));
var Q = require('q');
var router = require('express').Router(); // eslint-disable-line new-cap
var bodyParser = require('body-parser');
var csurf = require('csurf');
var request = require('request');
var _ = require('lodash');

var indieutil = require('@rcarls/indieutil');
var micropub = require('connect-micropub');
var Note = require(path.resolve(__dirname, '../models/note'));

var app = require(path.resolve(__dirname, '../app'));

router.use(bodyParser.urlencoded({ extended: true, }));
router.use(csurf());

var client = {
  responseTypes: [
    // RSVP
    { name: 'Reply', value: 'in-reply-to', },
    { name: 'Repost', value: 'repost-of', },
    { name: 'Like', value: 'like-of', },
    { name: 'Bookmark', value: 'bookmark-of', },
    { name: 'Tag', value: 'tag-of', },
  ],
};

router.get('/', function(req, res) {
  client.responseTypes.forEach(function(type) {
    if (req.query[type.value]) {
      client.currentResponseType = type.value;
    }
  });
  
  return res.render('client/client.nunj.html', {
    site: app.locals.site,
    user: req.user,
    client: _.assign(client, req.query),
    session: req.session,
    _csrf: req.csrfToken(),
  });
});

router.post('/update/:property', function(req, res) {
  if (!req.user) { return res.redirect(req.baseUrl); }
  
  switch(req.params.property) {
  case 'endpoint':
    var config;
    var endpoint;

    if (req.body.endpoint === 'other') {
      endpoint = req.body['endpoint-other'];
    } else {
      endpoint = req.body.endpoint;
    }
    
    // Update the user's preferred endpoint and fetch config
    if (req.session.preferredEndpoint !== endpoint) {
      req.session.preferredEndpoint = endpoint;

      request.get(endpoint, {
        auth: {
          bearer: req.user.token,
        },
        qs: { q: 'config', }
      }, function(err, response, body) {
        if (!err) {
          try {
            config = JSON.parse(body);
          } catch(err) {
            config = {};
          }
        }

        req.session.config = config;

        return res.redirect(req.baseUrl);
      });
    }
    break;
  case 'responseType':
    var type = req.body.responseType;
    var targets = req.body[type];

    return res.redirect(req.baseUrl + '?' + type + '[]');
    break;
  }
});

router.post('/post', function(req, res, next) {
  // Format categories
  req.body.category = req.body.category
    .split(/[\s,]+/);
  
  delete req.body._csrf;
  
  // Post to user's micropub endpoint
  request.post(req.session.preferredEndpoint, {
    auth: {
      bearer: req.user.token,
    },
    form: req.body,
  }, function(err, response, body) {
    if (err) {
      logger.error(err);
      return next(err);
    }

    if (response.statusCode !== 201) {
      return res.redirect(req.baseUrl + '#failed');
    }
    
    return res.redirect(response.headers.location);
  });
});

router.get('/preview', function(req, res) {
  return res.end('Preview not loaded');
});

router.post('/preview', function(req, res) {
  // Format categories
  req.body.category = req.body.category
    .split(/[\s,]+/);
  
  delete req.body._csrf;
  
  // Post to user's micropub endpoint
  request.post(req.session.config.preview, {
    auth: {
      bearer: req.user.token,
    },
    form: req.body,
  }, function(err, response, body) {
    return res.status(200).end(body);
  });
});

module.exports = router;
