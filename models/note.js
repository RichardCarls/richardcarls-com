var logger = require('../lib/logger');
var mongoose = require('mongoose');
var app = require('../app');
var slug = require('slug');
var autoIncrement = require('mongoose-auto-increment');
var moment = require('moment');

slug.defaults.mode='rfc3986';

var noteSchema = new mongoose.Schema({
  _noteId: { type: Number, },
  _slug: { type: String, index: { unique: true, sparse: true, }, },
  
  type: { type: String, set: setType, get: getType, },
  properties: { type: Object, },
}, {
  strict: false,
  toObject: { virtuals: true, },
  toJSON: { virtuals: true, },
});

noteSchema.plugin(autoIncrement.plugin, { model: 'Note', field: '_noteId', });

noteSchema.virtual('permalink').get(function() {
  return [
    app.locals.site.url,
    'notes',
    this._slug
  ].join('/');
});

noteSchema.methods.prop = function(prop) {
  var value = this.properties[prop];

  if (typeof value === 'undefined') {
    return null;
  }

  if (Array.isArray(value)) {
    if (value.length === 1) {
      return value[0];
    }

    return value;
  }

  return null;
};

function getType(value) {
  return [value];
}

function setType(value) {
  if (!Array.isArray(value)) {
    return [value];
  }

  return value;
}

noteSchema.pre('validate', function(next) {
  // Enforce published
  var published = this.properties.published;
  if (Array.isArray(published)) {
    published = published[0];
  }
  published = moment(published) || moment();
  this.properties.published = [published];
  
  // Populate slug
  if (!this._slug) {
    var name = this.properties.name;
    logger.debug('name', name);
    if (name && name.length) {
      this._slug = slug(name);
    } else {
      this.nextCount(function(err, count) {
        if (err) { return next(err); }
        
        this._slug = 'untitled-' + count;
      });
    }
  }

  return next();
});

module.exports = mongoose.model('Note', noteSchema);
