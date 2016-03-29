/* jshint node: true */
'use strict';

module.exports = {
    url: process.env.SITE_URL || 'https://dev.richardcarls.com:3443',
    pages: [
	{ name: 'Home', path: '/home', },
	{ name: 'Client', path: '/client', },
    ],
};
