var logger = require('../lib/logger');
var _ = require('lodash');
var Q = require('q');
var mongoose = require('mongoose');
var app = require('../app');
var slugify = require('slug');
var autoIncrement = require('mongoose-auto-increment');
var flat = require('flat');
var indieutil = require('@rcarls/indieutil');

slugify.defaults.mode='rfc3986';

var rsvpValues = [
  'invited', 'yes', 'no', 'maybe', 'interested',
];

var noteSchema = new mongoose.Schema({
  _noteId: { type: Number, },

  name: { type: String, },
  slug: { type: String, required: true, index: { unique: true, }, },
  summary: { type: String, },
  content: {
    'content-type': { type: String, },
    value: { type: String, },
  },
  published: { type: Date, required: true, default: Date.now(), },
  updated: { type: Date, },
  category: { type: [String], },
  //location: {},
  syndication: { type: [String], },
  rsvp: { type: String, enum: rsvpValues, },
  photo: { type: [String], },
  video: { type: [String], },
  audio: { type: [String], },

  'in-reply-to': { type: [String], },
  'like-of': { type: [String], },
  'tag-of': { type: [String], },
  'repost-of': { type: [String], },
  'bookmark-of': { type: [String], },

  comment: { type: [String], },
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

noteSchema.virtual('author')
  .get(function() {
    return app.locals.site.url + '/';
  });

noteSchema.virtual('noteTypes')
  .get(function() {
    return indieutil.determinePostTypes(this.paths);
  });

noteSchema.virtual('mentions')
  .get(function() {
    var mentions = [].concat(
      this['in-reply-to'],
      this['repost-of'],
      this['like-of'],
      this['bookmark-of'],
      this['tag-of']
    );
    
    mentions = _.uniq(_.compact(mentions));
    
    return mentions;
  });

noteSchema.statics.findByUrl = function(url) {
  return this.findOne({
    slug: url.substr(url.lastIndexOf('/') + 1),
  });
};


/**
 * Formats note to JF2
 * 
 * @private
 * @param {Boolean} [compact=true] - Enable simplification
 * @return {Object} - The JF2 data object
 */
noteSchema.methods.toJf2 = function(compact) {
  compact = (compact !== false);
  
  // Remove internal properties
  var jf2 = _.omitBy(this.toObject(), _.isEmpty);
  jf2 = _.omit(jf2, [
    '_id', '_noteId', '_noteTypes', '__v', '_mentions', 'id',
  ]);

  if (!compact) { return jf2; }

  // Compact
  return _.mapValues(jf2, function(value) {
    // Flatten single element arrays
    if (Array.isArray(value)
        && value.length === 1) {
      value = value[0];
    }

    // Plain-text content object to string value
    if (value['content-type'] === 'text/plain') {
      value = value.value;
    }

    return value;
  });
};


noteSchema.methods.getReplyContext = function(callback) {
  var note = this;

  // TODO
};


noteSchema.methods.getResponses = function(callback) {
  var note = this;

  return Q.resolve(note['comment'])
    .then(function(urls) {
      if (!urls || !urls.length) { throw new TypeError('No responses.'); }

      return Q.allSettled(urls.map(function(url) {
        return cacheGet(url)
          .then(function(response) {
            if (!response) {
              return indieutil.fetch(url, {
                filter: ['h-entry'],
              })
                .then(function(mf2) {
                  return cachePut(url, indieutil.entryToCite(mf2.items[0]));
                });
            }

            return response;
          });
      }))
        .then(function(fetchTasks) {
          return _.filter(fetchTasks, { state: 'fulfilled', })
            .map(function(task) {
              return task.value;
            });
        })
        .then(function(responses) {
          note.comment = responses;

          logger.debug('responses', responses);

          return note;
        });
    })
    .catch(function(err) {
      logger.warn(err);
      
      return note;
    }).nodeify(callback);
  
};

function cacheGet(url, callback) {
  return Q.ninvoke(app.locals.contextCache, 'hgetall', url)
    .then(function(data) {
      if (!data) { return; }
      
      return flat.unflatten(data);
    }).nodeify(callback);
}

function cachePut(url, item) {
  var jf2 = indieutil.toJf2(item);
  delete jf2.references;

  app.locals.contextCache.hmset(url, flat(jf2));

  return jf2;
}

noteSchema.methods.fetchRefs = function(prop, callback) {
  var note = this;
  
  var urls = note[prop];
  if (!urls || !urls.length) { return Q.resolve(note).nodeify(callback); }
  if (!Array.isArray(urls)) { urls = [urls]; }
  
  return Q(urls.reduce(function(references, url) {
    return fetchContextCached(url)
      .then(function(context) {
        references[url] = context;

        if (context.author) {
          return fetchCardCached(context.author)
            .then(function(author) {
              references[context.author] = author;

              return references;
            });
        }

        return references;
      });
  }, {}))
    .then(function(references) {
      if (!_.isEmpty(references)) {
        note.references = references;
      }

      return note;
    }).nodeify(callback);
};


noteSchema.pre('validate', function(next) {
  var note = this;

  // Generate slug
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


/**
 * @private
 * @param {String} url - URL of the entry to fetch
 * @param {fetchContextCachedCB} callback - The fetchContextCached callback
 * @return {Promise<Error,Object>} - Promise for the JF2 h-cite object
 */
function fetchContextCached(url, callback) {

  /**
   * @callback fetchContextCachedCB
   * @param {Error|null} err - The Error object
   * @param {Object} context - The JF2 h-cite object
   */
  
  return Q.ninvoke(app.locals.contextCache, 'hgetall', url)
    .then(function(data) {
      // Cache miss
      if (!data) {
        logger.info('Cache miss: ' + url);
        
        return indieutil.fetch(url, { filter: ['h-entry'], })
          .then(function(mf2) {
            data = indieutil.entryToCite(mf2.items[0]);
            data = indieutil.toJf2(data);
            delete data.references;

            app.locals.contextCache.hmset(url, flat(data));

            return data;
          });
      }

      return flat.unflatten(data);
    }).nodeify(callback);
}


/**
 * @private
 * @param {String} url - URL of the card to fetch
 * @param {fetchCardCachedCB} callback - The fetchCardCached callback
 * @return {Promise<Error,Object>} - Promise for the JF2 h-card object
 */
function fetchCardCached(url, callback) {

  /**
   * @callback fetchCardCachedCB
   * @param {Error|null} err - The Error object
   * @param {Object} context - The JF2 h-card object
   */
  
  return Q.ninvoke(app.locals.contextCache, 'hgetall', url)
    .then(function(data) {
      // Cache miss
      if (!data) {
        logger.info('Cache miss: ' + url);
        
        return indieutil.fetch(url, { filter: ['h-card'], })
          .then(function(mf2) {
            data = indieutil.toJf2(mf2.items[0]);
            delete data.references;

            app.locals.contextCache.hmset(url, flat(data));

            return data;
          });
      }

      return flat.unflatten(data);
    }).nodeify(callback);
}
