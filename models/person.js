var mongoose = require('mongoose');

var personSchema = new mongoose.Schema({
  _id: { type: String, },
  
  name: { type: String, required: true, },
  photo: { type: [String], },
  url: { type: [String], },
}, {
  autoIndex: false,
  toJSON: { getters: true, transform: toJf2, },
  toObject: { getters: true, },
});

personSchema.index({ _id: 1, name: 1, });


/**
 * Gets the person's uid URL
 * 
 * @instance
 * @returns {String} - The person uid
 */
personSchema.virtual('uid').get(function() {
  return this._id;
});


/**
 * Sets the person's uid URL
 * 
 * @instance
 * @param {String} value - The person uid
 */
personSchema.virtual('uid').set(function(value) {
  this._id = value;
});


/**
 * Format to JF2
 * 
 * @private
 * @param {Object} doc - The Mongo document
 * @param {Object} ret - The object being returned
 * @param {Object} [options] - Any passed options object
 * @param {Boolean} [options.keepUnderscored=true] - If `false`, will rmeove
 * properties prefixed with an underscore. Default is `true`.
 * @returns {Object} - The transformed return object
 */
function toJf2(doc, ret, options) {
  options = options || {};
  options.keepUnderscored = (options.keepUnderscored !== false);
  
  for (var key in ret) {
    var value = ret[key];

    // Remove empty properties
    if (_.isEmpty(value)) {
      delete ret[key];
    }

    if (!options.keepUnderscored && _.startsWith(key, '_')) {
      delete ret[key];
    }
  }

  // Remove ids
  delete ret._id;
  delete ret.id;
}


module.exports = mongoose.model('Person', personSchema);
