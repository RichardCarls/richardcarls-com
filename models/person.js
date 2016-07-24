var logger = require('../lib/logger');
var mongoose = require('mongoose');

var personSchema = new mongoose.Schema({
  _id: { type: String, },
  
  name: { type: String, required: true, },
  uid: { type: String, },
  photo: { type: String, },
}, {
  toObject: { virtuals: true, },
  toJSON: {virtuals: true, },
});

personSchema.virtual('type')
  .get(function() {
    return 'card';
  });

personSchema.virtual('url')
  .get(function() {
    return this._id;
  });

module.exports = mongoose.model('Person', personSchema);
