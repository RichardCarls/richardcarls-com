var path = require('path');
var express = require('express');
var morgan = require('morgan');
var helmet = require('helmet');
var cors = require('cors');
var Q = require('q');
var passport = require('passport');
var IndieAuthStrategy = require('@rcarls/passport-indieauth');
var AnonymousStrategy = require('passport-anonymous');
var cookieSession = require('cookie-session');
var mongoose = require('mongoose');
var redis = require('redis');
var nunjucks = require('nunjucks');

var logger = require(path.resolve(__dirname, 'lib/logger'));

logger.info('Initializing app');

var app = module.exports = express();

// Config
var config;
if (process.env.NODE_ENV === 'development') {
  config = require(path.resolve(__dirname, './config/development'));
} else {
  config = require(path.resolve(__dirname, './config/production'));
}
app.locals = config;

// Static
app.use(express.static('./public_http'));

// Middleware
app
  .use(morgan('dev', { stream: logger.stream, }))
  .use(helmet())
  .use(cors())
  .use(cookieSession(config.site.session));


// Redis cache
logger.info('Attempting to connect to Redis at ' + config.redis.uri);

var cache = redis.createClient(config.redis.uri);
cache.on('error', function(err) {
  logger.error(err);
});

cache.on('connect', function() {
  logger.info('Established connection to Redis');
  app.locals.redis.cache = cache;

  // Clear cache
  logger.debug('Clearing cache');
  cache.flushdb();
});

// Database
logger.info('Attempting to connect to MongoDB at ' + config.mongo.uri);
mongoose.Promise = Q.Promise;
mongoose.connect(config.mongo.fulluri, {
  promiseLibrary: Q.Promise,
});

var db = mongoose.connection;
app.locals.mongo.db = db;

db.on('error', function(err) {
  logger.error(err);
});

db.on('open', function() {
  var Note = require('./models/note');
  var NoteContext = require('./models/note-context');
  var Person = require('./models/person');
  
  logger.info('Database connection open');

  // Drop collections
  var cols = Object.keys(db.collections);

  var dropTasks = cols.map(function(col) {
    return db.collections[col].drop()
      .catch(function(err) {
        if (err.message !== 'ns not found') {
          logger.error(err);
        }
      });
  });
  
  Q.all(dropTasks)
    .then(function() {
      logger.debug('Dropped collections');

      var testNote = new Note({
        name: 'Test Note',
        slug: 'test-note',
        content: {
          'content-type': 'text/plain',
          value: 'Lorem ipsum dolar sit amet.',
        },
        published: new Date(),
        category: ['Test'],
      });

      return testNote.save();
    })
    .then(function(note) {
      logger.debug('saved test note', note.toObject());
    })
    .catch(function(err) {
      logger.error(err);
    });
});


// Passport
app.use(passport.initialize());
app.use(passport.session());

passport.use(new IndieAuthStrategy({
  clientId: config.site.url + '/',
  redirectUri: config.site.redirectUri,
  scopeDelimiter: ',', // for node-micropub-express
  passReqToCallback: true,
}, function(req, uid, token, profile, done) {
  var user = {
    uid: uid,
    token: token,
  };

  // TODO: Save as Person, include uid, token, micropub endpoint in session

  if (profile.name.formatted) {
    user.name = profile.name.formatted;
  }

  if (profile.photos && profile.photos.length) {
    user.photo = profile.photos[0].value;
  }

  if (profile._json.rels && profile._json.rels['micropub']) {
    user.micropub = profile._json.rels['micropub'];
  }

  return done(null, user, {});
}));
passport.use(new AnonymousStrategy({}));

passport.serializeUser(function(user, done) {
  // TODO: Save as Person to db
  return done(null, user);
});

passport.deserializeUser(function(user, done) {
  // TODO Load Person from domain key
  return done(null, user);
});

// Views
var viewsEnv = new nunjucks.Environment(
  new nunjucks.FileSystemLoader('views', { noCache: true, }),
  { autoescape: true, }
);
viewsEnv.addFilter('date', require('nunjucks-date-filter'));
viewsEnv.addFilter('urlfilter', function(str) {
  if (!str && str !== 0 && str !== false) {
    return false;
  }

  str = str + '';

  if(str.indexOf('javascript:') !== -1) {
    return '#filtered';
  }

  return str;
});
viewsEnv.express(app);

// Webmention
app.use('/webmention', require(path.resolve(__dirname, './routes/webmention')));

// Micropub
app.use('/micropub', require(path.resolve(__dirname, './routes/micropub')));

// Client
app.use('/client', require(path.resolve(__dirname, './routes/client')));

// Auth
app.use('/auth', require(path.resolve(__dirname, './routes/auth')));

// Enable user session
app.use(passport.authenticate(['indieauth', 'anonymous',]));

// Headers
app.use(function(req, res, next) {
  res.links({
    authorization_endpoint: config.site.authorizationEndpoint,
    token_endpoint: config.site.tokenEndpoint,
    micropub: config.site.micropubEndpoint,
  });

  return next();
});

// Routing
app.use('/notes', require(path.resolve(__dirname, './routes/notes')));
app.use('/', require(path.resolve(__dirname, './routes/home')));

process.on('SIGINT', function() {
  cache.quit();
  logger.info('Connection to Redis closed.');

  // TODO: check close method
  app.locals.mongo.db.close()
    .then(function () {
      logger.info('Connection to MongoDB closed.');
      process.exit(0);
    });
});
