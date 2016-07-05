var siteUrl = process.env.SITE_URL || 'https://dev.richardcarls.com:3443';

module.exports = {
  url: siteUrl,
  redirectUri: siteUrl + '/auth',
  authorizationEndpoint: 'https://indieauth.com/auth',
  tokenEndpoint: 'https://tokens.indieauth.com/token',
  micropubEndpoint: siteUrl + '/micropub',
  pages: [
    { name: 'Home', path: '/', },
    { name: 'Notes', path: '/notes', },
    { name: 'Client', path: '/client', },
  ],
};
