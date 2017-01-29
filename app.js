/* global: Promise */

process.env.APP_ROOT = __dirname
require('es6-promise').polyfill()

const fs = require('fs')
const path = require('path')

const winston = require('winston')
const yaml = require('js-yaml')
const express = require('express')
const morgan = require('morgan')
const helmet = require('helmet')
const cors = require('cors')
const passport = require('passport')
const IndieAuthStrategy = require('@rcarls/passport-indieauth')
const AnonymousStrategy = require('passport-anonymous')
const cookieSession = require('cookie-session')
const mongoose = require('mongoose')
const nunjucks = require('nunjucks')

winston.info('Initializing app')

const app = express()

let config
try {
  // Load config
  config = app.locals = yaml.safeLoad(
    fs.readFileSync(path.resolve(__dirname, './config.yml')))
} catch (ex) {
  winston.error(ex)
  process.exit(0)
}

// Build
// TODO: move into separate module, implement initial build
const processor = require('postcss')()

processor
  .use(require('postcss-import'))
  .use(require('postcss-custom-properties'))
  .use(require('autoprefixer'))

const chokidar = require('chokidar')
const watcher = chokidar.watch('./css/**/*.css')

const entry = path.resolve(__dirname, './css/main.css')
const output = path.resolve(__dirname, './public_http/assets/css/styles.css')

watcher.on('change', (path, stats) => {
  fs.readFile(entry, (err, file) => {
    if (err) {
      winston.error(err)
      process.exit(0)
    }

    winston.info('initiating build')
    
    processor
      .process(file, {
        from: entry,
        to: output,
        autoprefixer: {
          browsers: [
            'ie >= 9',
            'android >= 3',
            '> 5%'
          ]
        }
      })
      .then(result => {
        if (result.warnings) {
          result.warnings().forEach(warn => winston.warn(warn))
        }
        
        fs.writeFile(
          output,
          result.css,
          err => {
            if (err) {
              winston.error(err)
            }

            winston.info('build complete')
          })
      })
      .catch(err => winston.error(err))
  })
})

app
  .use(morgan('dev', { stream: {
    write (msg, enc) { winston.info(msg) }
  } }))
  .use(helmet())
  .use(cors())
  .use(cookieSession({
    name: 'session',
    secret: process.env.COOKIE_SECRET || 'cookie_secret',
    path: '/',
    httpOnly: true,
    secure: true,
    maxAge: null
  }))
  .use(passport.initialize())
  .use(passport.session())

module.exports = app

// Passport
passport.use(new IndieAuthStrategy({
  clientId: `${config.site.url}/`,
  redirectUri: config.site.redirectUri,
  passReqToCallback: true
}, (req, uid, token, profile, done) => {
  const user = {
    uid: uid,
    token: token
  }

  if (profile.name.formatted) {
    user.name = profile.name.formatted
  }

  if (profile._json.rels && profile._json.rels['micropub']) {
    user.micropub = profile._json.rels['micropub']
  }

  return done(null, user, {})
}))

passport.use(new AnonymousStrategy())

passport.serializeUser((user, done) => done(null, user))
passport.deserializeUser((user, done) => done(null, user))

// Database
mongoose.Promise = Promise

const dbConfig = {
  user: process.env.MONGO_USER || 'ghast_user',
  pass: process.env.MONGO_PASS || 'ghast_pwd',
  host: process.env.MONGO_HOST || '127.0.0.1',
  port: process.env.MONGO_PORT || '27017',
  name: process.env.MONGO_DB || 'db'
}

const connectionUri = (({ user, pass, host, port, name }) => {
  return `mongodb://${user}:${pass}@${host}:${port}/${name}`
})(dbConfig)

winston.info(`Connecting to MongoDB at ${dbConfig.host}:${dbConfig.port}`)

mongoose.connect(connectionUri, {
  promiseLibrary: Promise
})

const db = mongoose.connection
db.on('open', () => {
  const Note = require('./models/note')
  
  // Drop collections
  var cols = Object.keys(db.collections)

  var dropTasks = cols.map(col => {
    return db.collections[col].drop()
      .catch(err => {
        if (err.message !== 'ns not found') {
          winston.error(err)
        }
      })
  })
  
  Promise.all(dropTasks)
    .then(() => {
      winston.debug('Dropped collections')

      var testNote = new Note({
        name: 'Test Note',
        slug: 'test-note',
        content: {
          'content-type': 'text/plain',
          value: 'Lorem ipsum dolar sit amet.'
        },
        published: new Date(),
        category: ['Test']
      })

      return testNote.save()
    })
    .then(note => winston.debug('saved test note', note.toObject()))
    .catch(err => winston.error(err))
})
db.on('error', err => winston.error(err))

// Views
const viewsEnv = new nunjucks.Environment(
  new nunjucks.FileSystemLoader('views', { noCache: true }),
  { autoescape: true }
)
viewsEnv.addFilter('date', require('nunjucks-date-filter'))
viewsEnv.addFilter('urlfilter', str => {
  if (!str && str !== 0 && str !== false) {
    return false
  }

  str = str + ''

  if (str.indexOf('javascript:') !== -1) {
    return '#filtered'
  }

  return str
})
viewsEnv.express(app)

// Static
app.use(express.static('./public_http'))

app
  .use('/auth', require('./routes/auth'))
  .use('/micropub', require('./routes/micropub'))
  .use('/webmention', require('./routes/webmention'))
  .use('/client', require('./routes/client'))

// Enable user session
app.use(passport.authenticate(['indieauth', 'anonymous']))

// Advertise endpoints in Link header
app.use((req, res, next) => {
  res.links({
    authorization_endpoint: config.site.authorizationEndpoint,
    redirect_uri: config.site.redirectUri,
    token_endpoint: config.site.tokenEndpoint,
    micropub: config.site.micropubEndpoint,
    webmention: config.site.webmentionEndpoint
  })

  return next()
})

// Routing
app
  .use('/notes', require(path.resolve(__dirname, './routes/notes')))
  .use('/', require(path.resolve(__dirname, './routes/home')))

process.on('SIGINT', () => {
  // TODO: check close method
  db
    .close()
    .then(() => {
      winston.info('Connection to MongoDB closed.')
      process.exit(0)
    })
})
