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
var mongodb = require('mongodb');
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
  .use(cookieSession(config.session));

// Database
logger.info('Attempting to connect to MongoDB at ' + config.mongoose.uri);
mongoose.connect(config.mongoose.uri, config.mongoose.connectOptions);

var db = mongoose.connection;
db.on('connected', function() {
  logger.info('Established connection to MongoDB');

  autoIncrement.initialize(db);
  
  // Clear db
  var Note = require('./models/note');
  var NoteContext = require('./models/note-context');
  var Person = require('./models/person');
  
  Note.remove({}, function(err) {});
  NoteContext.remove({}, function(err) {});
  Person.remove({}, function(err) {});
  
  // Reset note ID count
  Note.resetCount(function(err) {});
  
  // Passport
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(new IndieAuthStrategy({
    clientId: config.site.url + '/',
    redirectUri: config.site.url + '/auth',
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

  logger.info('Database and sessions initialized');

  // Views
  var viewsEnv = new nunjucks.Environment(
    new nunjucks.FileSystemLoader('views', { noCache: true, }),
    { autoescape: true, }
  );
  viewsEnv.addFilter('date', require('nunjucks-date-filter'));
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
});

db.on('error', function(err) {
  logger.error(err);
});

process.on('SIGINT', function() {
  db.close(function () {
    logger.info('Connection to MongoDB closed.');
    process.exit(0);
  });
});
