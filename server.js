/* jshint node: true */
'use strict';

var fs = require('fs'),
    http = require('http'),
    https = require('https');

var logger = require(__dirname + '/lib/logger.js'),
    app = require(__dirname + '/app.js');

// HTTP Redirect
if (!process.env.PORT) {
    logger.error('Missing "PORT" environment variable');
    
    return;
}
var insecureServer = http.createServer(function(req, res) {
    res.writeHead(301, {
       'Content-Type':  'text/plain', 
       'Location':      'https://'+req.headers.host+req.url
    });
    res.end('Redirecting to SSL\n');
}).listen(process.env.PORT);

// HTTPS Server
if (!process.env.SECURE_PORT || !process.env.CERTS_DIR) {
    logger.error('Missing "SECURE_PORT" or "CERTS_DIR" environment variables');
    
    return;
}

var secureOptions = {
    key: fs.readFileSync(process.env.CERTS_DIR + '/privkey.pem'),
    cert: fs.readFileSync(process.env.CERTS_DIR + '/cert.pem'),
    ca: fs.readFileSync(process.env.CERTS_DIR + '/chain.pem'),
};

if (!secureOptions.key || !secureOptions.cert || !secureOptions.ca) {
    logger.error('Missing SSL credentials');
    
    return;
}

var secureServer = https.createServer(secureOptions, app)
    .listen(process.env.SECURE_PORT, function(error) {
        logger.info('Listening on https port ' + process.env.SECURE_PORT);
    });

