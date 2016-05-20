/* jshint node: true */
'use strict';

module.exports = {
    name: 'session',
    secret: process.env.COOKIE_SECRET || 'cookie_secret',
    path: '/',
    httpOnly: true,
    secure: true,
    maxAge: null,
};
