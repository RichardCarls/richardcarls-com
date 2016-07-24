var logger = require('../lib/logger');
var _ = require('lodash');
var mongoose = require('mongoose');

var noteContextSchema = new mongoose.Schema({
  _id: { type: String, },
  _content: { type: String, },
  
  name: { type: String, },
  uid: { type: String, },
  published: { type: Date, required: true, index: true, },
  accessed: { type: Date, required: true, default: Date.now(), },
  publication: { type: String, },

  author: { type: String, ref: 'Person', },
}, {
  toObject: { virtuals: true, },
  toJSON: {virtuals: true, },
});

noteContextSchema.virtual('type')
  .get(function() {
    return 'cite';
  });

noteContextSchema.virtual('url')
  .get(function() {
    return this._id;
  });

noteContextSchema.virtual('content')
  .get(function() {
    return {
      'content-type': 'text/plain',
      value: this._content,
    };
  })
  .set(function(value) {
    if (!Array.isArray(value)) { value = [value]; }
    
    this._content = _.find(value, { 'content-type': 'text/plain', }).value;
  });

module.exports = mongoose.model('NoteContext', noteContextSchema);
