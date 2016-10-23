var mongoose = require('mongoose');
var logger = require('../lib/logger');
var _ = require('lodash');
var moment = require('moment');
var indieutil = require('@rcarls/indieutil');

var app = require('../app');


/**
 * @module Note
 */


/**
 * Valid content types
 * 
 * @private
 */
var contentTypes = [
  'text/plain',
  'text/html',
  'text/markdown',
];

/**
 * Mapping of repsonse types to target properties
 * 
 * @private
 */
var responseContextMapping = {
  reply: 'in-reply-to',
  repost: 'repost-of',
  like: 'like-of',
  bookmark: 'bookmark-of',
  tag: 'tag-of',
};


/**
 * Mongoose schema for a Note
 * 
 * @member {mongoose.Schema} schema
 */
var noteSchema = new mongoose.Schema({
  'in-reply-to': [{ type: String, ref: 'NoteContext', }],
  'repost-of': [{ type: String, ref: 'NoteContext', }],
  'like-of': [{ type: String, ref: 'NoteContext', }],
  'bookmark-of': [{ type: String, ref: 'NoteContext', }],
  'tag-of': [{ type: String, ref: 'NoteContext', }],

  name: { type: String, },
  slug: { type: String, required: true, unique: true, },
  content: {
    'content-type': { type: String, enum: contentTypes, },
    value: { type: String, },
  },
  published: {
    type: Date,
    required: true,
    //validate: isValidDate,
    get: getISO8601Date,
  },
  updated: {
    type: Date,
    //validate: isValidDate,
    get: getISO8601Date,
  },
  
  category: { type: [String], default: void 0, },
  photo: { type: [String], default: void 0, },
  // location

  comment: [{ type: String, ref: 'NoteContext', }],

  // _numReplies, _numLikes, etc...
}, {
  autoIndex: false,
  toJSON: { getters: true, transform: toMf2, },
  toObject: { getters: true, transform: toJf2, },
});

noteSchema.index({
  published: -1, slug: 1,
});


/**
 * Gets the note type
 * 
 * @instance
 * @returns {String} - The note type. Default is `'entry'`.
 */
noteSchema.virtual('type').get(function() {
  return 'entry';
});


/**
 * Gets the permalink (uid/url) for this note
 * 
 * @instance
 * @returns {String} - The note's permalink URL
 */
noteSchema.virtual('url').get(function() {
  return [
    app.locals.site.url,
    'notes',
    this.slug
  ].join('/');
});


/**
 * Gets an ordered set of post types representing this note
 * 
 * The first type is the representative type.
 * 
 * @instance
 * @returns {[String]} - Array of post types
 */
noteSchema.virtual('_postTypes').get(function() {
  return indieutil.determinePostTypes(this);
});


/**
 * Gets the set of webmention target URLs
 * 
 * @instance
 * @returns {[String]} - Array of target URLs
 */
noteSchema.virtual('_mentionTargets').get(function() {
  return indieutil.determineMentionTargets(this);
});


/**
 * Gets the primary reply context target property
 * 
 * @instance
 * @returns {String} - The primary target property
 */
noteSchema.virtual('_targetProperty').get(function() {
  // TODO: Invoke virtual within virtual?
  return responseContextMapping[this._postTypes[0]];
});



/**
 * Returns the target property represetative of the post type
 * 
 * @instance
 * @returns {[NoteContext]} - The reply context(s)
 */
noteSchema.virtual('_replyContext').get(function() {
  if (!this._targetProperty) {
    return null;
  }
  
  return this[this._targetProperty];  
});


noteSchema.query.byUrl = function(url) {
  // TODO: Handle trailing slash
  return this.findOne({ slug: url.substr(url.lastIndexOf('/') + 1), });
};


noteSchema.query.populateReplyContexts = function() {
  var configs = [
    'in-reply-to',
    'repost-of',
    'like-of',
    'bookmark-of',
    'tag-of',
  ];

  configs = configs.map(function(prop) {
    return { path: prop, populate: { path: 'author', }, };
  });

  return configs.reduce(function(query, config) {
    return query.populate(config);
  }, this);
};


noteSchema.query.populateComments = function(options) {
  return this.populate({
    path: 'comment',
    populate: { path: 'author', },
    options: options,
  });
};


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


function toMf2(doc, ret, options) {
  return ret;
}


/**
 * Validation function for dates
 * 
 * @param {*} value - The value to test
 * @returns {Boolean} - `true` if parseable into a valid date
 */
function isValidDate(value) {
  return moment(value).isValid();
}


function isValidUrl(value) {
  //return require('valid-url').isUri(value);
  return true;
};


/**
 * Returns a date value as an ISO8601 datestring
 * 
 * @getter
 * @param {Number} value - The document date value
 * @returns {String} - The ISO8601 datestring
 */
function getISO8601Date(value) {
  return moment(value).toISOString();
}


module.exports = mongoose.model('Note', noteSchema);
