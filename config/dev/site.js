var siteUrl = process.env.SITE_URL || 'https://dev.richardcarls.com:3443';

module.exports = {
  url: siteUrl,
  redirectUri: siteUrl + '/auth',
  authorizationEndpoint: 'https://indieauth.com/auth',
  tokenEndpoint: 'https://tokens.indieauth.com/token',
  pages: [
    { name: 'Home', path: '/home', },
    { name: 'Client', path: '/client', },
  ],
};
