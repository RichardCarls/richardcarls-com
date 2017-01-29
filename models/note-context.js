const _ = require('lodash')
const mongoose = require('mongoose')
const moment = require('moment')

/**
 * @module Note
 */

/**
 * Set of valid original post types
 *
 * @private
 */
const postTypes = [
  'rsvp',
  'reply',
  'repost',
  'like',
  'bookmark',
  'tag',
  'article',
  'note'
]

/**
 * Set of valid repsonse types for response contexts
 *
 * @private
 */
const responseTypes = [
  'rsvp',
  'reply',
  'repost',
  'like',
  'bookmark',
  'tag',
  'mention'
]

/**
 * Mongoose schema for a NoteContext
 *
 * @member {mongoose.Schema} schema
 */
const noteContextSchema = new mongoose.Schema({
  _id: { type: String },

  name: { type: String },
  content: { type: String },
  published: {
    type: Date,
    required: true,
    // TODO: validation
    get: getISO8601Date
  },
  accessed: {
    type: Date,
    required: true,
    // TODO: validation
    get: getISO8601Date
  },

  author: { type: String, ref: 'Person', required: true },

  photo: { type: [String] },

  _postTypes: { type: [String], enum: postTypes },
  _responseTypes: { type: [String], enum: responseTypes }
}, {
  autoIndex: false,
  toJSON: { getters: true },
  toObject: { getters: true, transform: toJf2 }
})

noteContextSchema.index({ _id: 1, published: -1 })

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
function toJf2 (doc, ret, options = {}) {
  options.keepUnderscored = (options.keepUnderscored !== false)

  for (let key in ret) {
    const value = ret[key]

    // Remove empty properties
    if (_.isEmpty(value)) {
      delete ret[key]
    }

    if (!options.keepUnderscored && _.startsWith(key, '_')) {
      delete ret[key]
    }
  }

  // Remove ids
  delete ret._id
  delete ret.id
}

/**
 * Gets the note context type
 *
 * @instance
 * @returns {String} - The note type. Default is `'cite'`.
 */
noteContextSchema.virtual('type').get(() => 'cite')

/**
 * Gets the note context URL
 *
 * @instance
 * @returns {String} - The context URL
 */
noteContextSchema.virtual('url').get(function () {
  return this._id
})

/**
 * Sets the note context URL
 *
 * @instance
 * @param {String} value - The context URL
 */
noteContextSchema.virtual('url').set(function (value) {
  if (Array.isArray(value)) {
    this._id = value[0]
  } else {
    this._id = value
  }
})

/**
 * Gets the note context uid URL
 *
 * @instance
 * @returns {String} - The context uid URL
 */
noteContextSchema.virtual('uid').get(function () {
  return this._id
})

/**
 * Returns a date value as an ISO8601 datestring
 *
 * @getter
 * @param {Number} value - The document date value
 * @returns {String} - The ISO8601 datestring
 */
function getISO8601Date (value) {
  return moment(value).toISOString()
}

module.exports = mongoose.model('NoteContext', noteContextSchema)
