const knex = require('knex');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set. Refusing to start without a database configuration.');
}

const db = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL,
  // Serverless/cloud-friendly pool. Neon (and most hosted Postgres) drop idle
  // connections; holding them open (min>0) makes the app crash with
  // "Connection ended unexpectedly". min:0 means we open connections on demand
  // and let idle ones go, so a dropped idle connection can never crash us.
  pool: {
    min: 0,
    max: 10,
    idleTimeoutMillis: 30000,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    reapIntervalMillis: 10000,
  },
  acquireConnectionTimeout: 30000,
});

// A dropped/erroring connection should be logged, never crash the process.
db.client.pool.on('error', (err) => {
  console.error('[db pool] connection error (ignored, will reconnect):', err.message);
});
process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err && err.message ? err.message : err);
});

module.exports = db;
