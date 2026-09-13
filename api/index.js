/**
 * Vercel Serverless Entry Point
 *
 * Vercel calls this file as a serverless function for every request.
 * It loads the built Express app (app/dist/server.cjs) and delegates to it.
 */

const path = require('path');
const app = require(path.join(__dirname, '..', 'app', 'dist', 'server.cjs'));

module.exports = app.default || app;
