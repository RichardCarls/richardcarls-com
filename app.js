var path = require('path');
var express = require('express');
var morgan = require('morgan');
var helmet = require('helmet');
var cors = require('cors');
var bodyParser = require('body-parser');
var csurf = require('csurf');
var passport = require('passport');
var IndieAuthStrategy = require('@rcarls/passport-indieauth');
var AnonymousStrategy = require('passport-anonymous');
var cookieSession = require('cookie-session');
var mongoose = require('mongoose');
var nunjucks = require('nunjucks');

var logger = require(path.resolve(__dirname, 'lib/logger'));


/**
 * @module app
 */

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
  .use(morgan('dev', { "stream": logger.stream }))
  .use(helmet())
  .use(cors())
  .use(bodyParser.json())
  .use(bodyParser.urlencoded({ extended: true, }))
  .use(cookieSession(config.session))
  .use(csurf());

// Database
logger.info('Attempting to connect to MongoDB at ' + config.mongoose.uri);
mongoose.connect(config.mongoose.uri, config.mongoose.connectOptions);

var db = mongoose.connection;
db.on('connected', function() {
  logger.info('Established connection to MongoDB');

  var Note = mongoose.model('Note', require(path.resolve(__dirname, './models/note')));

  // Passport
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(new IndieAuthStrategy({
    clientId: config.site.url + '/',
    redirectUri: config.site.url + '/auth',
    passReqToCallback: true,
  }, function(req, domain, scope, profile, done) {
    var user = {
      me: domain,
      scope: scope,
      profile: profile,
    };
    
    logger.debug('profile', { profile: profile, });
    
    return done(null, user, {});
  }));
  passport.use(new AnonymousStrategy({}));
  
  passport.serializeUser(function(user, done) {
    return done(null, user);
  });

  passport.deserializeUser(function(user, done) {
    return done(null, user);
  });

  logger.info('Database and sessions initialized');
  
  // Views
  var viewsEnv = new nunjucks.Environment(
    new nunjucks.FileSystemLoader('views', { noCache: true, }),
    { autoescape: true, }
  );
  viewsEnv.express(app);

  // Headers
  app.use(function(req, res, next) {
    res.links({
      authorization_endpoint: config.site.authorizationEndpoint,
      token_endpoint: config.site.tokenEndpoint,
    });

    return next();
  });

  // Auth
  app.use('/auth', require(path.resolve(__dirname, './routes/auth')));
  app.use(passport.authenticate(['indieauth', 'anonymous']));
  
  // Routing
  app
    .use('/client', require(path.resolve(__dirname, './routes/client')))
    .use('/', require(path.resolve(__dirname, './routes/home')));
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
