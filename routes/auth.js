const path = require('path')

const router = require('express').Router()
const bodyParser = require('body-parser')
const passport = require('passport')
const csurf = require('csurf')

const app = require(path.resolve(process.env.APP_ROOT, './app'))

// TODO: bundle bodyParser with IndieAuthStrategy
router
  .use(bodyParser.urlencoded({ extended: true }))
  .use(csurf())

router.all('/', passport.authenticate(['indieauth'], {
  successRedirect: '/#successauth',
  failureRedirect: '/#failauth'
}))

router.use(passport.authenticate(['indieauth', 'anonymous']))
router.get('/login', (req, res) => {
  return res.render('login-page.nunj.html', {
    site: app.locals.site,
    user: req.user,
    _csrf: req.csrfToken()
  })
})

router.get('/logout', (req, res) => {
  req.session = null

  return res.redirect('/#logout')
})

module.exports = router
