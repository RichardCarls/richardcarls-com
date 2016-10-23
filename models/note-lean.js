/**
 * @module Note
 */

var logger = require('../lib/logger');
var _ = require('lodash');
var Q = require('q');
var ObjectId = require('mongodb').ObjectId;
var slugify = require('slug');
var flat = require('flat');
var moment = require('moment');
var indieutil = require('@rcarls/indieutil');

var app = require('../app');
var NoteContext = require('./note-context');

slugify.defaults.mode='rfc3986';


/**
 * List of target properties for different types of responses
 * 
 * @private
 */
var targetProperties = [
  'in-reply-to',
  'repost-of',
  'like-of',
  'bookmark-of',
  'tag-of',
];

/**
 * Mapping of post type to target property
 * 
 * @private
 */
var contextMap = {
  reply: 'in-reply-to',
  repost: 'repost-of',
  like: 'like-of',
  bookmark: 'bookmark-of',
  tag: 'tag-of',
};

/**
 * Recognized rsvp values
 * 
 * @private
 */
var rsvpValues = [
  'invited', 'yes', 'no', 'maybe', 'interested',
];

/**
 * List of properties to omit from the database
 * 
 * @private
 */
var omitPropsList = [];

/**
 * Virtual and computed properties
 * 
 * @private
 */
var virtualDefs = {
  type: {
    value: 'entry',
    enumerable: true,
  },
  postTypes: {
    get: getPostTypes,
    enumerable: true,
  },
  url: {
    get: getUrl,
    enumerable: true,
  },
  mentions: {
    get: getMentions,
    enumerable: true,
  },
  replyContext: {
    get: getReplyContext,
    enumerable: true,
  },
  targetProperty: {
    get: getTargetProperty,
    enumerable: true,
  },
};


/**
 * List of indexes to create on initialization
 * 
 * @private
 */
var indexes = [
  // For Note lists and slug lookup
  { published: -1, slug: 1, },
];


/**
 * Note model
 * 
 * @constructor
 * @param {Object} [properties] - The properties object. Properties can be
 * an existing document, MF2, or JF2.
 */
function Note(doc) {
  _.assign(this, doc);

  // Convert ObjectId to HexString or generate new id
  this._id = new ObjectId(this._id)
    .toHexString();
  
  // Convert dates to ISO8601
  if (this.published) {
    this.published = moment.unix(this.published).toISOString();
  }
  if (this.updated) {
    this.updated = moment.unix(this.updated).toISOString();
  }

  // Cast note contexts
  targetProperties.forEach(function(prop) {
    if (this[prop] && Array.isArray(this[prop])) {
      this[prop] = this[prop].map(function(context) {
        return new NoteContext(context);
      });
    }
  }.bind(this));
  
  if (this.responses) {
    this.responses = this.responses
      .map(function(context) {
        return new NoteContext(context);
      });
  }
}

// Set virtual properties
Object.defineProperties(Note.prototype, virtualDefs);

module.exports = Note;


/**
 * Persists the Note to the database
 * 
 * @instance
 * @param {saveCallback} [callback] - The save callback
 * @returns {Promise<Error, Note>} - Promise for the persisted Note
 */
Note.prototype.save = function(callback) {

  /**
   * @callback saveCallback
   * @param {Error|null} err - The Error object
   * @param {Note|null} note - The persisted Note
   */
  
  var note = this;

  return Note.$ready()
    .then(function(col) {
      return note.validate()
        .then(function() {
          // Convert to doc for proper _id and avoid persisting virtuals
          var doc = note.toDoc();
          
          return col
            .updateOne({ _id: doc._id, }, doc, { upsert: true, });
        });
    })
    .then(function() {
      return note;
    }).nodeify(callback);
};


/**
 * Returns a simple properties object suitable for storing in the database.
 * 
 * @instance
 * @returns {Object} - The simpified properties object
 */
Note.prototype.toDoc = function() {
  var doc = _.omit(this, omitPropsList);

  // Convert _id to proper ObjectId
  doc._id = ObjectId.createFromHexString(this._id);

  // Convert dates to Unix timestamps
  if (doc.published) {
    doc.published = moment(doc.published).unix();
  }
  if (doc.updated) {
    doc.updated = moment(doc.updated).unix();
  }
  
  // Convert note contexts
  targetProperties.forEach(function(prop) {
    if (this[prop]) {
      this[prop] = this[prop].map(function(context) {
        return context.toDoc();
      });
    }
  }.bind(this));
  
  if (this.responses) {
    this.responses = this.responses
      .map(function(context) {
        return context.toDoc();
      });
  }
  
  return doc;
};


/**
 * Validates the Note properties, and applies transforms
 * 
 * @instance
 * @param {validateCallback} [callback] - The validate callback
 * @returns {Promise<Error, Boolean>} - Promise for the validation result
 */
Note.prototype.validate = function(callback) {

  /**
   * @callback validateCallback
   * @param {Error|null} err - The Error object
   * @param {Boolean|null} isValid - The validation result
   */

  // TODO: Make synchronous ...
  var deferred = Q.defer();
  
  // p-slug
  if (!this.slug) {
    if (this.name) {
      // Slugify the name
      this.slug = slugify(this.name);
    } else {
      // Generate a slug
      // TODO: Generate prettier slugs
      this.slug = 'untitled-' + moment().format();
    }
  }

  // TODO: Make published required, client can auto generate
  if (!this.published) {
    this.published = moment().format();
  }

  var validationTasks = [];

  // Validate note contexts
  targetProperties.forEach(function(prop) {
    if (this[prop]) {
      this[prop].forEach(function(context) {
        validationTasks.push(context.validate());
      });
    }
  }.bind(this));
  
  if (this.responses) {
    this.responses.forEach(function(context) {
      validationTasks.push(context.validate());
    });
  }
  
  Q.all(validationTasks)
    .then(function() {
      // Validation successful
      deferred.resolve(true);
    })
    .catch(function(err) {
      deferred.reject(err);
    });

  return deferred.promise.nodeify(callback);
};


/**
 * Perform find query and return results as Note objects
 * 
 * @static
 * @param {Object} query - The query object
 * @param {Object} [options] - The options object
 * @param {Object} [options.sort] - Sort query option
 * @param {Object} [options.project] - Project query option
 * @param {findCallback} [callback] - The find callback
 * @returns {Promise<Error,Note[]>} - Promise for the results of the query
 */
Note.find = function(query, options, callback) {

  /**
   * @callback findCallback
   * @param {Error|null} err - the Error object
   * @param {Note[]|null} notes - The query results as Note objects
   */
  
  return Note.$ready()
    .then(function(col) {
      var cursor = col.find(query);

      // TODO: collection.find() options deprecated, implement
      if (options.sort) {
        cursor = cursor.sort(options.sort);
      }

      if (options.project) {
        cursor = cursor.project(options.project);
      }
      
      return cursor;
    })
    .then(function(cursor) {
      // TODO: Stream with promises
      return cursor.toArray();
    })
    .then(function(docs) {
      return docs.map(function(doc) {
        return new Note(doc);
      });
    }).nodeify(callback);
};


/**
 * Perform a findOne query and return the result as a Note object
 * 
 * @static
 * @param {Object} query - The query object
 * @param {findOneCallback} [callback] - The findOne callback
 * @returns {Promise<Error,Note> - Promise for the found Note, or null.
 */
Note.findOne = function(query, callback) {

  /**
   * @callback findOneCallback
   * @param {Error|null} err - The Error object
   * @param {Note|null} note - The found Note
   */

  return Note.$ready()
    .then(function(col) {
      return col.find(query, callback)
        .limit(1)
        .next();
    })
    .then(function(doc) {
      return new Note(doc);
    }).nodeify(callback);
};


/**
 * Wrapper for findOne using a Note permalink
 * 
 * @static
 * @param {String} url - The Note permalink URL
 * @param {findOneByUrlCallback} [callback] - The findOneByUrl callback
 * @returns {Promise<Error,Note> - Promise for the found Note, or null.
 */
Note.findOneByUrl = function(url, callback) {

  /**
   * @callback findOneByUrlCallback
   * @param {Error|null} err - The Error object
   * @param {Note|null} note - The found Note
   */
  
  return Note.findOne({
    slug: url.substr(url.lastIndexOf('/') + 1),
  }).nodeify(callback);
};


/**
 * Ensures the database collection and indexes exist
 * 
 * @static
 * @param {Object} [options] - The options object
 * @param {initializeCallback} [callback] - The initialize callback
 * @returns {Promise<Error,Boolean>} - Promise for the initialize result
 */
Note.initialize = function(options, callback) {

  /**
   * @callback initializeCallback
   * @param {Error|null} err - The Error object
   * @param {Boolean} isInitialized - The result of initialize
   */

  options = options || {};
  options.drop = !!options.drop;
  options.indexes = options.indexes !== false;

  logger.info('Initializing notes collection');

  // Define the ignore list for database persistence
  omitPropsList = omitPropsList.concat(
    Object.keys(Note.prototype),
    virtualDefs
  );
  
  return Note.$ready()
    .then(function(col) {
      var ops = [];
      
      if (options.drop) {
        // Drops collection + indexes
        // TODO: Check for collection first instead of ignoring errors
        logger.debug('Dropping collection');
        ops.push(col.drop().catch(function() {}));
      }
      if (options.indexes) {
        // Creates indexes on the collection
        // TODO: createIndexes doesn't work with an array of specs?
        logger.debug('Creating indexes');
        indexes.map(function(spec) {
          ops.push(col.createIndex(spec));
        });
      }
        
      return Q.allSettled(ops);
    })
    .then(function(results) {
      var failed = _.filter(results, { state: 'rejected', });
      
      if (failed.length) {
        failed.forEach(function(result) {
          logger.error(result.reason);
        });

        logger.warn('Notes collection initialized with errors');
        return false;
      }

      logger.info('Notes collection initialized');
      return true;
    }).nodeify(callback);
};


/**
 * Provides the database collection once available
 * 
 * @static
 * @param {$readyCallback} [callback] - The $ready callback
 * @returns {Promise<Error,Collection>} - The notes collection
 */
Note.$ready = function(callback) {

  /**
   * @callback $readyCallback
   * @param {Error|null} err - The Error object
   * @param {Collection} col - The notes collection
   */

  // Waits for connection
  return Q.when(app.locals.mongo.client)
    .then(function(db) {
      return db.collection('notes')
    });
};


/**
 * Returns an ordered set of post types determined by Note properties
 * 
 * The first type in the set can be considered the representative type.
 * 
 * @private
 * @returns {String[]} - The set of post types
 */
function getPostTypes() {
  return indieutil.determinePostTypes(this);
}
  

/**
 * Constructs a permalink for the Note
 * 
 * @private
 * @returns {String} - The Note permalink
 */
function getUrl() {
  return [
    app.locals.site.url,
    'notes',
    this.slug
  ].join('/');
}


/**
 * Returns set of mention targets
 * 
 * @private
 * @returns {String[]} - The set of mention targets
 */
function getMentions() {
  return indieutil.determineMentionTargets(this);
}


/**
 * Returns the Note target property representative of it's post type
 * 
 * @returns {NoteContext[]} - The array of context objects
 */
function getReplyContext() {
  var targetProp = contextMap[this.postTypes[0]];

  if (!targetProp) { return null; }

  return this[targetProp];
}


function getTargetProperty() {
  return contextMap[this.postTypes[0]];
}
