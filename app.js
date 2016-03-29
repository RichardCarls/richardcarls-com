/* jshint node: true */
'use strict';

var path = require('path'),
    express = require('express'),
    morgan = require('morgan'),
    helmet = require('helmet'),
    cors = require('cors'),
    bodyParser = require('body-parser'),
    cookieParser = require('cookie-parser'),
    mongoose = require('mongoose'),
    nunjucks = require('nunjucks');

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

// Middleware
app
    .use(morgan('dev', { "stream": logger.stream }))
    .use(helmet())
    .use(cors())
    .use(bodyParser.json())
    .use(bodyParser.urlencoded({ extended: true, }))
    .use(cookieParser());

// Database
logger.info('Attempting to connect to MongoDB at ' + config.mongoose.uri);
mongoose.connect(config.mongoose.uri, config.mongoose.connectOptions);
var db = mongoose.connection;
db.on('connected', function() {
    logger.info('Established connection to MongoDB');

    var Note = mongoose.model('Note', require(path.resolve(__dirname, './models/note')));
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

// Views
var viewsEnv = new nunjucks.Environment(
    new nunjucks.FileSystemLoader('views', { noCache: true, }),
    { autoescape: true, }
);
viewsEnv.express(app);

// Routing
app
    .use('/client', require(path.resolve(__dirname, './routes/client')))
    .use('/', require(path.resolve(__dirname, './routes/home')))
    .use(express.static('./public_http'));
