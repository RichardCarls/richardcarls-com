const winston = require('winston')

const router = require('express').Router()
const throwjs = require('throw.js')
const webmention = require('@rcarls/connect-webmention')

const Note = require('../models/note')
const NoteContext = require('../models/note-context')
const Person = require('../models/person')

router.post('', webmention.receive({
  // TODO: implement these options in connect-webmention
  jf2: {
    preferredContentType: 'text/plain',
    implicitContentType: 'text/plain',
    compact: false
  },
  responseAs: 'cite'
}), (req, res) => {
  if (req.webmention.error) {
    winston.warn(req.webmention.error)
    
    return res
      .status(req.webmention.error.status || 500)
      .send(req.webmention.error.message)
  }

  const jf2 = req.webmention.data

  // Set url if not parsed
  jf2.url = jf2.url || req.webmention.source

  // Set post types of source
  // TODO: Rename to responseTypes and store both type arrays
  jf2._postTypes = req.webmention.postTypes
  jf2._responseTypes = req.webmention.responseTypes

  // Set accessed
  jf2.accessed = new Date()

  // Remove implicit name
  if (req.webmention.postTypes.indexOf('article') === -1) {
    delete jf2.name
  }

  // TODO: Same as micropub upsert Person
  const saveTasks = Object.keys(jf2.references).map(url => {
    const ref = jf2.references[url]

    // Ignore embedded cites (comments and such)
    if (ref.type === 'card') {
      // TODO: Set uid in toJf2 or fetch
      if (!ref.uid) {
        ref.uid = Array.isArray(ref.url) ? ref.url[0] : ref.url
      }

      Person
        .findOne({ _id: ref.uid })
        .exec()
        .then(person => {
          if (!person) {
            return new Person(ref).save()
          }

          return person
        })
        .then(person => {
          winston.info(`Saved new person ${person.uid}`)
        })
    }

    return null
  })

  delete jf2.references

  return Promise.all([
    new NoteContext(jf2).save(),
    Promise.all(saveTasks)
  ])
    .then(([response, refs]) => {
      return Note
        .find()
        .byUrl(req.webmention.target)
        .exec()
    })
    .then(note => {
      if (!note) {
        throw new throwjs.badRequest('Target could not be found.')
      }

      note.comment.push(req.webmention.source)
      
      return note.save()
    })
    .then(note => {
      if (!note) {
        throw new throwjs.internalServerError('Problem updating target.')
      }

      winston.info(`Saved new ${jf2._postTypes[0]} response 
from ${req.webmention.source}`)
      
      return res
        .status(201)
        .send()
    })
    .catch(err => {
      // TODO: Find rep. h-card if not enough author info (name + url)
      winston.warn(err)
      
      return res
        .status(err.statusCode || 500)
        .send()
    })
})

module.exports = router
