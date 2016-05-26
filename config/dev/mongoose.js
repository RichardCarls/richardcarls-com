module.exports = {
  uri: 'mongodb://' + (process.env.MONGO_HOST || '127.0.0.1')
    + ':' + (process.env.MONGO_PORT || '27017')
    + '/' + (process.env.MONGO_DB || 'db'),
  connectOptions: {
    user: process.env.MONGO_USER || 'db_user',
    pass: process.env.MONGO_PASS || 'supersecretpwd',
  },
};
