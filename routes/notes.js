const path = require('path')

const winston = require('winston')
const router = require('express').Router()

const Note = require(path.resolve(process.env.APP_ROOT, './models/note'))
const app = require(path.resolve(process.env.APP_ROOT, './app'))

router.get('/', (req, res) => {
  Note.find({})
    .populateReplyContexts()
    .sort({ published: -1 })
    .exec()
    .then(notes => res.render('notes.nunj.html', {
      site: app.locals.site,
      profile: app.locals.profile,
      user: req.user,
      notes: notes.map(note => note.toObject())
    }))
    .catch(err => winston.error(err))
})

router.get('/:slug', (req, res) => {
  Note.findOne({ slug: req.params.slug })
    .populateReplyContexts()
    .populateComments({
      sort: { published: -1 }
      // TODO: limit, from, to
    })
    .exec()
    .then(note => {
      return res.render('note-page.nunj.html', {
        site: app.locals.site,
        profile: app.locals.profile,
        user: req.user,
        note: note.toObject()
      })
    })
    .catch(err => {
      winston.error(err)
      
      return res
        .status(404)
        .send()
    })
})

module.exports = router
