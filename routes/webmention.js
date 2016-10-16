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

router.post('/', webmention.receive({
  // TODO: implement these options in connect-webmention
  jf2: {
    preferredContentType: 'text/plain',
    implicitContentType: false,
    compact: false,
    references: 'embed',
  },
  responseAs: 'cite',
}), function(req, res) {
  if (req.webmention.error) {
    logger.warn(req.webmention.error);
    
    return res.status(req.webmention.error.status || 500)
      .send(req.webmention.error.message);
  }

  var response = new NoteContext(req.webmention.data);

  // Set url if not parsed
  response.url = response.url || req.webmention.source;

  // Set post types of source
  // TODO: Rename to responseTypes and store both type arrays
  response.postTypes = req.webmention.responseTypes;

  // Set accessed
  response.accessed = new Date();

  // Remove implicit name
  if (req.webmention.postTypes.indexOf('article') === -1) {
    delete response.name;
  }

  logger.debug('response', response);
  
  Note.findOneByUrl(req.webmention.target)
    .then(function(note) {
      if (!note) {
        throw new throwjs.badRequest('Target could not be found.');
      }

      note.responses = note.responses || [];
      note.responses.push(response);
      
      return note.save();
    })
    .then(function(note) {
      if (!note) {
        throw new throwjs.internalServerError('Problem updating target.');
      }

      logger.info('Saved new ' + response.postTypes[0]
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
