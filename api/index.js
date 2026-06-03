// Vercel serverless entry point.
// Exports the Express app as a handler (no app.listen - Vercel invokes it).
// All /api/* requests are routed here by vercel.json.
const app = require('../backend/src/app');
module.exports = app;
