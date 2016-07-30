var path = require('path');
var router = require('express').Router(); // eslint-disable-line new-cap

var Note = require(path.resolve(__dirname, '../models/note'));
var app = require(path.resolve(__dirname, '../app'));
var logger = require(path.resolve(__dirname, '../lib/logger.js'));

router.get('/', function(req, res) {
  Note.find({})
    .sort('-published')
    .exec(function(err, notes) {
    if (err) { logger.error(err); }
    
    return res.render('notes/notes-list.nunj.html', {
      locals: app.locals,
      user: req.user,
      notes: notes,
    });
  });
});

router.get('/:slug', function(req, res) {
  Note.findOne({ slug: req.params.slug, }).exec()
    .then(function(note) {
      return note.toJf2();
    })
    .then(function(note) {
      logger.debug('note', note);
      
      return res.render('notes/notes-single.nunj.html', {
        locals: app.locals,
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
