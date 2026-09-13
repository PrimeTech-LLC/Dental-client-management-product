/**
 * Vercel Serverless Entry Point
 *
 * Vercel calls this file as a serverless function for every request.
 * It loads the built Express app (dist/server.cjs) and delegates to it.
 */

const path = require('path');

// Load the compiled Express app from the build output
const app = require(path.join(__dirname, '..', 'dist', 'server.cjs'));

module.exports = app.default || app;
