var path = require('path');

var siteUrl = process.env.SITE_URL || 'https://dev.richardcarls.com:3443';

module.exports = {
  /**
   * Site Configuration
   */
  site: {
    name: 'Richard Carls',
    tagline: 'Full stack JavaScript developer',
    url: siteUrl,
    redirectUri: siteUrl + '/auth',
    authorizationEndpoint: 'https://indieauth.com/auth',
    tokenEndpoint: 'https://tokens.indieauth.com/token',
    openidServer: 'https://indieauth.com/openid',
    micropubEndpoint: siteUrl + '/micropub',
    webmentionEndpoint: siteUrl + '/webmention',
    session: {
      name: 'session',
      secret: process.env.COOKIE_SECRET || 'cookie_secret',
      path: '/',
      httpOnly: true,
      secure: true,
      maxAge: null,
    },
    pages: [
      { name: 'Home', path: '/', },
      { name: 'Notes', path: '/notes', },
      { name: 'Client', path: '/client', },
    ],

    /**
     * Personal h-card
     */
    me: {
      type: 'card',
      'given-name': 'Richard',
      'family-name': 'Carls',
      name: 'Richard Carls',
      photo: 'https://placehold.it/150x150',
      url: [
        // First url is u-uid
        siteUrl,
        'https://github.com/RichardCarls',
        'https://google.com/+RichardCarls',
        'https://twitter.com/RichardCarls',
      ],
      email: 'richard.j.carls@gmail.com',
      locality: 'Cheektowaga',
      region: 'New York',
      'country-name': 'US',
      'job-title': 'Web Developer',
      org: {
        type: 'card',
        name: 'Citi',
        url: 'http://citi.com',
      },
    },
  },

  /**
   * MongoDB
   */
  mongo: {
    uri: 'mongodb://' + (process.env.MONGO_HOST || '127.0.0.1')
      + ':' + (process.env.MONGO_PORT || '27017')
      + '/' + (process.env.MONGO_DB || 'db'),
    fulluri: 'mongodb://'
      + process.env.MONGO_USER
      + ':' + process.env.MONGO_PASS + '@'
      + (process.env.MONGO_HOST || '127.0.0.1')
      + ':' + (process.env.MONGO_PORT || '27017')
      + '/' + (process.env.MONGO_DB || 'db'),
    auth: {
      user: process.env.MONGO_USER || 'db_user',
      pass: process.env.MONGO_PASS || 'supersecretpwd',
    },

    /**
     * Client
     */
    client: null,
  },

  /**
   * Redis
   */
  redis: {
    uri: 'redis://' + (process.env.REDIS_HOST || '127.0.0.1')
    + ':' + (process.env.REDIS_PORT || '6379')
      + '/' + (process.env.REDIS_DB || '0'),

    /**
     * General cache (unimplemented)
     */
    cache: null,
  },
};
