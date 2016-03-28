/* jshint node: true */
'use strict';

/**
 * @module logger
 */

var path = require('path'),
    fs = require('fs'),
    winston = require('winston');

var logFilePath = path.resolve(__dirname, '../logs');

// Make log directory if it doesn't exist
try {
    fs.mkdirSync(logFilePath);
} catch(err) {
    if (err.code !== 'EEXIST') {
        throw err;
    }
}

// Export a winston logger instance
var logger = new winston.Logger({
    level: process.env.NODE_ENV == 'development' ? 'debug' : 'warn',
    transports: [
        new winston.transports.File({ filename: logFilePath + '/all.log', }),
        new winston.transports.Console({ colorize: true, prettyPrint: true, depth: 3, }),
    ],
    exitOnError: false,
});

logger.stream = {
    write: function(message, encoding){
        logger.info(message);
    }
};

module.exports = logger;