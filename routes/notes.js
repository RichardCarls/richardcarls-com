var path = require('path');
var router = require('express').Router(); // eslint-disable-line new-cap

var Note = require(path.resolve(__dirname, '../models/note'));
var app = require(path.resolve(__dirname, '../app'));
var logger = require(path.resolve(__dirname, '../lib/logger.js'));

router.get('/', function(req, res) {
  // TODO: Don't return _responses for list view
  Note.find({}, {
    sort: { published: -1, },
    project: { responses: false, },
  })
    .then(function(notes) {
      return res.render('notes.nunj.html', {
        site: app.locals.site,
        user: req.user,
        notes: notes,
      });
    })
    .catch(function(err) {
      logger.error(err);
    });
});

router.get('/:slug', function(req, res) {
  Note.findOne({ slug: req.params.slug, })
    .then(function(note) {      
      return res.render('note-page.nunj.html', {
        site: app.locals.site,
        user: req.user,
        note: note,
      });
    })
    .catch(function(err) {
      logger.error(err);
      
      return res.status(404).send();
    });

});

module.exports = router;
