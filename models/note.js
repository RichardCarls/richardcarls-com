var logger = require('../lib/logger');
var _ = require('lodash');
var mongoose = require('mongoose');
var app = require('../app');
var slugify = require('slug');
var autoIncrement = require('mongoose-auto-increment');

slugify.defaults.mode='rfc3986';

var rsvpValues = [
  'invited', 'yes', 'no', 'maybe', 'interested',
];

var noteSchema = new mongoose.Schema({
  _noteId: { type: Number, },
  _content: { type: String, },

  name: { type: String, },
  slug: { type: String, required: true, index: { unique: true, }, },
  summary: { type: String, },
  published: { type: Date, required: true, default: Date.now(), },
  updated: { type: Date, },
  category: { type: [String], },
  //location: {},
  syndication: { type: [String], },
  rsvp: { type: String, enum: rsvpValues, },
  photo: { type: [String], },
  video: { type: [String], },
  audio: { type: [String], },

  'in-reply-to': { type: [String], ref: 'NoteContext', },
  'like-of': { type: [String], ref: 'NoteContext', },
  'repost-of': { type: [String], ref: 'NoteContext', },
  'bookmark-of': { type: [String], ref: 'NoteContext', },

  comment: [{ type: String, ref: 'NoteContext', }],
}, {
  strict: false,
  toObject: { virtuals: true, },
  toJSON: { virtuals: true, },
});

noteSchema.plugin(autoIncrement.plugin, { model: 'Note', field: '_noteId', });

noteSchema.virtual('type')
  .get(function() {
    return 'entry';
  });

noteSchema.virtual('url')
  .get(function() {
    return [
      app.locals.site.url,
      'notes',
      this.slug
    ].join('/');
  });

noteSchema.virtual('content')
  .get(function() {
    return {
      'content-type': 'text/plain',
      value: this._content,
    };
  })
  .set(function(value) {
    if (!Array.isArray(value)) { value = [value]; }

    this._content = _.get(_.find(value, { 'content-type': 'text/plain', }), 'value');
  });

noteSchema.virtual('author')
  .get(function() {
    return app.locals.site.url + '/';
  });

noteSchema.virtual('mentions')
  .get(function() {
    var mentions = [].concat(
      this['in-reply-to'],
      this['repost-of'],
      this['like-of'],
      this['bookmark-of']
    );
    
    mentions = _.uniq(_.compact(mentions));
    
    return mentions;
  });

noteSchema.statics.findByUrl = function(url) {
  return this.findOne({
    slug: url.substr(url.lastIndexOf('/') + 1),
  });
};

noteSchema.pre('validate', function(next) {
  var note = this;

  if (!note.slug) {
    if (note.name) {
      note.slug = slugify(note.name);
      return next();
    } else {
      note.nextCount(function(err, count) {
        if (err) { return next(err); }
        
        note.slug = 'untitled-' + count;
        return next();
      });
    }
  } else {
    return next();
  }
});

module.exports = mongoose.model('Note', noteSchema);
