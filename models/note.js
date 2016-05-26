var mongoose = require('mongoose');

var noteSchema = new mongoose.Schema({
  content: { type: String, },
  published: { type: Date, },
}, {
  toObject: { virtuals: true, },
  toJSON: { virtuals: true, },
});

module.exports = noteSchema;
