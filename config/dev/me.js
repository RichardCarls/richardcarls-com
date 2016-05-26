var siteUrl = process.env.SITE_URL || 'https://dev.richardcarls.com:3443';

module.exports = {
  firstName: 'Richard',
  lastName: 'Carls',
  photo: siteUrl + '/assets/images/richard_carls.png',
  tagline: 'Full stack JavaScript developer',
  jobTitle: 'Web Developer',
  employer: { name: 'Citi', url: 'http://www.citi.com', },
  locality: 'Cheektowaga',
  region: { full: 'New York', abbr: 'NY', },
  country: { full: 'United States', abbr: 'US', },
  email: 'richard.j.carls@gmail.com',
  profiles: [
    { name: 'Blog', url: siteUrl, uid: true, },
    { name: 'GitHub', url: 'https://github.com/RichardCarls', },
    { name: 'Google+', url: 'https://google.com/+RichardCarls', },
    { name: 'Twitter', url: 'https://twitter.com/RichardCarls', },
  ],
};
