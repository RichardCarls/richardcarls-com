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

router.post('/', webmention.receive(), function(req, res) {
  if (req.webmention.error) {
    logger.warn(req.webmention.error);
    return res.status(req.webmention.error.status || 500)
      .send(req.webmention.error.message);
  }
  
  var jf2 = indieutil.toJf2(
    indieutil.entryToCite(req.webmention.data), {
      preferredContentType: 'text/plain',
      implicitContentType: false,
      compact: false,
      references: false,
    });

  var response = new NoteContext(jf2);

  // Set url if not parsed
  response.url = response.url || [req.webmention.source];

  // Set post types of source
  response.postTypes = indieutil
    .determinePostTypes(req.webmention.data);

  // Set accessed date
  response.accessed = new Date();
  
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
