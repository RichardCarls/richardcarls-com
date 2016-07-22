var path = require('path');
var logger = require(path.resolve(__dirname, '../lib/logger'));
var router = require('express').Router(); // eslint-disable-line new-cap
var bodyParser = require('body-parser');
var _ = require('lodash');
var Q = require('q');
var webmentions = require('webmentions');
var indieutil = require('indieutil');
var moment = require('moment');
var Note = require('../models/note.js');
var NoteContext = require('../models/note-context.js');

var app = require(path.resolve(__dirname, '../app'));

router.post('/', bodyParser.urlencoded({ extended: false, }), function(req, res) {
  webmentions.validateMention({
    source: req.body.source,
    target: req.body.target,
  }, function(err, data) {
    if (!err && data && data.isValid) {
      
      Note.findByUrl(data.target.url, function(err, note) {
        if (err || !note) {
          logger.warn('Note ' + data.target.url + ' not found!');
          return res.status(500).send();
        }

        var response = indieutil.entryToCite(data.source.entry);
        response = indieutil.toJf2(response);
        response._id = data.source.url;
        response.accessed = moment().format();

        new NoteContext(response)
          .save(function(err, context) {
            if (err || !context) {
              logger.error('Problem saving context', err);
              return res.status(500).send();
            }
            
            note.comment.push(context._id);

            note.save(function(err, note) {
              if (err || !note) {
                logger.warn('Problem updating note ' + data.target.url);
                return res.status(500).send();
              }

              logger.info('Saved new response from ' + data.source.url);

              return res.status(201).send();
            });
          });
      });
    } else {
      return res.status(400).send();
    }
  });
});

module.exports = router;
