var path = require('path');
var logger = require(path.resolve(__dirname, '../lib/logger'));
var router = require('express').Router(); // eslint-disable-line new-cap
var micropub = require('micropub-express');

var app = require(path.resolve(__dirname, '../app'));

router.post('', micropub({
  tokenReference: {
    me: app.locals.url,
    endpoint: app.locals.site.tokenEndpoint,
  },
  handler: function(mpData, req) {
    logger.debug('mpData', { mpData: mpData, });
    // TODO
  },
}));

module.exports = router;
