const path = require('path')
const router = require('express').Router()

const app = require(path.resolve(process.env.APP_ROOT, './app'))

router.get('/', (req, res) => res.render('home.nunj.html', {
  site: app.locals.site,
  profile: app.locals.profile,
  user: req.user
  // TODO: Recent Notes
}))

module.exports = router
