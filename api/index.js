/**
 * Vercel Serverless Entry Point
 *
 * Loads the built Express app (app/dist/server.mjs) and exports it
 * as a Vercel-compatible request handler.
 */

const path = require('path');
const serverPath = path.join(__dirname, '..', 'app', 'dist', 'server.mjs');

let appPromise = null;

function getApp() {
  if (!appPromise) {
    appPromise = import(serverPath).then(mod => mod.default || mod);
  }
  return appPromise;
}

module.exports = async (req, res) => {
  const app = await getApp();
  app(req, res);
};
