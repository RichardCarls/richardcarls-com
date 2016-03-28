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

var logger = require(path.resolve(__dirname, 'lib/logger.js'));


/**
 * @module app
 */

logger.info('Initializing app');

var app = module.exports = express();

// Middleware
app
    .use(morgan('dev', { "stream": logger.stream }))
    .use(helmet())
    .use(cors())
    .use(bodyParser.json())
    .use(bodyParser.urlencoded({ extended: true, }))
    .use(cookieParser());

// Database
mongoose.connect('mongodb://mongo:27017/richardcarls-com', {
    user: process.env.MONGO_USER,
    pass: process.env.MONGO_PASS,
});
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
    //.use('/micropub', require(path.resolve(__dirname, './routes/micropub')))
    .use('/', require(path.resolve(__dirname, './routes/home')))
    .use(express.static('./public_http'));
