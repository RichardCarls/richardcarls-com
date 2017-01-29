const path = require('path')
const fs = require('fs')
const http = require('http')
const https = require('https')

const winston = require('winston')
winston.configure({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transports: [
    new winston.transports.Console({
      colorize: true,
      prettyPrint: true,
      depth: 5
    })
  ]
})

const isDev = process.env.NODE_ENV === 'development'

winston.info(`Starting ${isDev ? 'development' : 'production'} server`)

const app = require('./app')

const port = process.env.PORT || isDev ? 3000 : 80
const securePort = process.env.SECURE_PORT || isDev ? 3443 : 443
const certsPath = process.env.CERTS_DIR || __dirname

const paths = {
  key: path.resolve(certsPath, 'privkey.pem'),
  cert: path.resolve(certsPath, 'cert.pem'),
  ca: path.resolve(certsPath, 'chain.pem')
}

let httpsConfig

try {
  httpsConfig = {
    key: fs.readFileSync(paths.key),
    cert: fs.readFileSync(paths.cert),
    ca: fs.readFileSync(paths.ca)
  }
} catch (e) {
  // TODO: allow only http server
  winston.error('Could not read one or more key file paths', e)
  process.exit(0)
}

const secureServer = https.createServer(httpsConfig, app)
secureServer.listen(securePort, err => {
  if (err) {
    winston.error(err)
    process.exit(0)
  }

  winston.info(`Listening on secure port ${securePort}`)
})

const insecureServer = http.createServer((req, res) => {
  // TODO: Security concerns redirecting to https?
  res.writeHead(301, {
    'Content-Type': 'text/plain',
    Location: `https://${req.headers.host + req.url}`
  })

  res.end('Redirecting to SSL\n')
})

insecureServer.listen(port, err => {
  if (err) {
    winston.error(err)
    process.exit(0)
  }

  winston.info(`Listening on port ${port}`)
})
