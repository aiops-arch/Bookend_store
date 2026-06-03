// Runtime config fallback for non-secret defaults.
// Secrets such as DATABASE_URL and JWT_SECRET must come from platform env vars
// or local .env files. The app intentionally refuses to start without them.
const env = process.env;

env.JWT_EXPIRES_IN = env.JWT_EXPIRES_IN || '8h';
env.ALLOWED_ORIGINS = env.ALLOWED_ORIGINS || '*';

module.exports = {};
