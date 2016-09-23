/**
 * @module NoteContext
 */

var _ = require('lodash');
var Q = require('q');
var moment = require('moment');
var flat = require('flat');
var logger = require('../lib/logger');
var indieutil = require('@rcarls/indieutil');

var app = require('../app');


var omitPropsList = [];

/**
 * Virtual and computed properties
 * 
 * @private
 */
var virtualDefs = {
  type: {
    value: 'cite',
    enumerable: true,
  },
};


/**
 * @member {String[]} postTypes - Array of post types describing the
 * source note
 */


/**
 * NoteContext model
 * 
 * @constructor
 * @param {Object} [properties] - The properties object. Properties can be
 * an existing document, MF2, or JF2.
 */
function NoteContext(properties) {
  _.assign(this, properties);

  // Convert dates to ISO8601
  if (this.published) {
    this.published = moment(this.published).toISOString();
  }
  if (this.accessed) {
    this.accessed = moment(this.accessed).toISOString();
  }
}

module.exports = NoteContext;


/**
 * Returns a simple properties object suitable for storing in the database.
 * 
 * @instance
 * @returns {Object} - The simpified properties object
 */
NoteContext.prototype.toDoc = function() {
  var doc = _.omit(this, omitPropsList);

  // convert dates to Unix timestamps
  if (doc.published) {
    doc.published = moment(doc.published).unix();
  }
  if (doc.accessed) {
    doc.accessed = moment(doc.accessed).unix();
  }
  
  return doc;
};


/**
 * Validates the NoteContext properties, and applies transforms
 * 
 * @instance
 * @param {validateCallback} [callback] - The validate callback
 * @returns {Promise<Error, Boolean>} - Promise for the validation result
 */
NoteContext.prototype.validate = function(callback) {

  /**
   * @callback validateCallback
   * @param {Error|null} err - The Error object
   * @param {Boolean|null} isValid - The validation result
   */

  // TODO: Make synchonous ...
  var deferred = Q.defer();

  deferred.resolve(true);
  
  if (!this.author) {
    deferred.reject(new TypeError('`author` is a required property.'));
  }

  if (!this.author.name) {
    deferred.reject(new TypeError('`author.name` is a required property.'));
  }

  if (!this.author.url) {
    deferred.reject(new TypeError('`author.url` is a required property.'));
  }
  
  if (!this.published) {
    deferred.reject(new TypeError('`published` is a required property.'));
  }
  
  if (!this.accessed) {
    deferred.reject(new TypeError('`accessed` is a required property.'));
  }

  return deferred.promise.nodeify(callback);
};
