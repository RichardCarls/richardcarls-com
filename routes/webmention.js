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

      var response = indieutil.entryToCite(data.source.entry);
      response = indieutil.toJf2(response);
      response._id = data.source.url;
      response.accessed = moment().format();

      logger.debug('response', response);

      var author = _.get(response, ['references', response.author,]);
      if (!author) {
        throw new throwjs.badRequest('Missing authorship information.');
      }
      author._id = author.url;

      return Q.all([
        Note.findByUrl(data.target.url).exec(),
        new NoteContext(response).save(),
        new Person(author).save(),
      ]);
    })
    .spread(function(note, context, author) {
      if (!note) {
        throw new throwjs.badRequest('Target could not be found.');
      }
      
      if (!context) {
        throw new throwjs.internalServerError('Problem storing response.');
      }

      if (!author) {
        throw new throwjs.internalServerError('Problem storing author.');
      }
      
      note.comment.push(context._id);

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
