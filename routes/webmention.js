var path = require('path');
var logger = require(path.resolve(__dirname, '../lib/logger'));
var router = require('express').Router(); // eslint-disable-line new-cap
var bodyParser = require('body-parser');
var _ = require('lodash');
var Q = require('q');
var throwjs = require('throw.js');
var webmentions = require('webmentions');
var indieutil = require('@rcarls/indieutil');
var moment = require('moment');
var Note = require('../models/note');
var NoteContext = require('../models/note-context');
var Person = require('../models/person');

var app = require(path.resolve(__dirname, '../app'));

router.post('/', bodyParser.urlencoded({ extended: false, }), function(req, res) {
  return Q.ninvoke(webmentions, 'validateMention', {
    source: req.body.source,
    target: req.body.target,
  })
    .then(function(data) {
      if (!data) {
        throw new throwjs.badRequest('Problem parsing Microformats');
      }

      if (!data.isValid) {
        throw new throwjs.badRequest('Source does not link to target');
      }

      if (!data.source.entry.properties.author) {
        throw new throwjs.badRequest('Missing authorship information.');
      }

      return Note.findByUrl(data.target.url).exec();
    })
    .then(function(note) {
      if (!note) {
        throw new throwjs.badRequest('Target could not be found.');
      }

      note.comment.push(req.body.source);
      
      return note.save();
    })
    .then(function(note) {
      if (!note) {
        throw new throwjs.internalServerError('Problem updating target.');
      }

      logger.info('Saved new response from ' + req.body.source);
      
      return res.status(201).send();
    })
    .catch(function(err) {
      logger.warn(err);

      return res.status(err.statusCode || 500).send();
    });
});

module.exports = router;
