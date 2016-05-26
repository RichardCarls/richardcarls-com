var path = require('path');
var fs = require('fs');
var winston = require('winston');

var logFilePath = path.resolve(__dirname, '../logs');

// Make log directory if it doesn't exist
try {
  fs.mkdirSync(logFilePath);
} catch (err) {
  if (err.code !== 'EEXIST') {
    throw err;
  }
}

// Export a winston logger instance
var logger = new winston.Logger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'warn',
  transports: [
    new winston.transports.File({ filename: logFilePath + '/all.log', }),
    new winston.transports.Console({
      colorize: true,
      prettyPrint: true,
      depth: 4,
    }),
  ],
  exitOnError: false,
});

logger.stream = {
  write: function(message){
    logger.info(message);
  },
};

module.exports = logger;
