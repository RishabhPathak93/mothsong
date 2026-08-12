'use strict';

const mongoose = require('mongoose');
const config = require('./config');

async function connect() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: 8000,
  });
  // eslint-disable-next-line no-console
  console.log('[db] connected to MongoDB');
  return mongoose.connection;
}

module.exports = { connect, mongoose };
