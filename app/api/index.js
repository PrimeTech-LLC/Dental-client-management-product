/**
 * Vercel Serverless Entry Point
 *
 * Vercel expects a default export of an Express/connect-compatible handler.
 * We build the Express app separately (without starting a server) and export it.
 *
 * Build: npm run build  → generates dist/server.cjs
 * The vercel.json routes /api/* to this file.
 */

// This file is only used when deploying to Vercel.
// For local dev, run: npm run dev  (starts server.ts directly with tsx)

import('../dist/server.cjs').then(mod => {
  module.exports = mod.default || mod;
}).catch(err => {
  console.error('Failed to load server module:', err);
});
