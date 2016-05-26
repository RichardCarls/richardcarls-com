var fs = require('fs');
var http = require('http');
var https = require('https');

var logger = require(__dirname + '/lib/logger.js');
var app = require(__dirname + '/app.js');

// HTTP Redirect
if (!process.env.PORT) {
  logger.error('Missing "PORT" environment variable');
}
var insecureServer = http.createServer(function(req, res) {
  res.writeHead(301, {
    'Content-Type':  'text/plain',
    'Location':      'https://' + req.headers.host + req.url,
  });
  res.end('Redirecting to SSL\n');
}).listen(process.env.PORT, function(err) {
  if (err) {
    logger.error(err);
    process.exit(0);
  }
});

// HTTPS Server
if (!process.env.SECURE_PORT || !process.env.CERTS_DIR) {
  logger.error('Missing "SECURE_PORT" or "CERTS_DIR" environment variables');
  process.exit(0);
}

var secureOptions = {
  key: fs.readFileSync(process.env.CERTS_DIR + '/privkey.pem'),
  cert: fs.readFileSync(process.env.CERTS_DIR + '/cert.pem'),
  ca: fs.readFileSync(process.env.CERTS_DIR + '/chain.pem'),
};

if (!secureOptions.key || !secureOptions.cert || !secureOptions.ca) {
  logger.error('Missing SSL credentials');
  process.exit(0);
}

var secureServer = https.createServer(secureOptions, app)
  .listen(process.env.SECURE_PORT, function(err) {
    if (err) {
      logger.error(err);
      process.exit(0);
    }

    logger.info('Listening on https port ' + process.env.SECURE_PORT);
  });
