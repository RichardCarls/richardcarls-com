var path = require('path');
var logger = require(path.resolve(__dirname, '../lib/logger'));
var _ = require('lodash');
var Q = require('q');

var router = require('express').Router(); // eslint-disable-line new-cap
var throwjs = require('throw.js');

var webmention = require('@rcarls/connect-webmention');
var indieutil = require('@rcarls/indieutil');
var app = require(path.resolve(__dirname, '../app'));
var Note = require('../models/note');
var NoteContext = require('../models/note-context');
var Person = require('../models/person');

router.post('/', webmention.receive({
  // TODO: implement these options in connect-webmention
  jf2: {
    preferredContentType: 'text/plain',
    implicitContentType: 'text/plain',
    compact: false,
  },
  responseAs: 'cite',
}), function(req, res) {
  if (req.webmention.error) {
    logger.warn(req.webmention.error);
    
    return res.status(req.webmention.error.status || 500)
      .send(req.webmention.error.message);
  }

  var jf2 = req.webmention.data;

  // Set url if not parsed
  jf2.url = jf2.url || req.webmention.source;

  // Set post types of source
  // TODO: Rename to responseTypes and store both type arrays
  jf2._postTypes = req.webmention.postTypes;
  jf2._responseTypes = req.webmention.responseTypes;

  // Set accessed
  jf2.accessed = new Date();

  // Remove implicit name
  if (req.webmention.postTypes.indexOf('article') === -1) {
    delete jf2.name;
  }

  var saveTasks = Object.keys(jf2.references).map(function(url) {
    var ref = jf2.references[url];

    // Ignore embedded cites (comments and such)

    if (ref.type === 'card') {
      // TODO: Set uid in toJf2 or fetch
      ref.uid = ref.uid || ref.url[0];
      
      return new Person(ref).save()
        .then(function(person) {
          logger.info('Saved new person: ' + person.name);
        });
    }

    return null;
  });

  delete jf2.references;

  return Q.all([
    new NoteContext(jf2).save(),
    Q.allSettled(saveTasks),
  ])
    .spread(function(response, refs) {
      return Note
        .find()
        .byUrl(req.webmention.target)
        .exec();
    })
    .then(function(note) {
      if (!note) {
        throw new throwjs.badRequest('Target could not be found.');
      }

      note.comment.push(req.webmention.source);
      
      return note.save();
    })
    .then(function(note) {
      if (!note) {
        throw new throwjs.internalServerError('Problem updating target.');
      }

      logger.info('Saved new ' + jf2._postTypes[0]
                  + ' response from ' + req.webmention.source);
      
      return res.status(201).send();
    })
    .catch(function(err) {
      // TODO: Find rep. h-card if not enough author info (name + url)
      logger.warn(err);
      
      return res.status(err.statusCode || 500).send();
    });
});

module.exports = router;
