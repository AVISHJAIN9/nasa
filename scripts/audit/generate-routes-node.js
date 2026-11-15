import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApp } from '../../backend/src/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_FILE = path.join(__dirname, 'routes-node.json');

async function generate() {
  const app = await createApp();
  const routes = [];

  function extractRoutes(stack, prefix = '') {
    for (const layer of stack) {
      if (layer.route) {
        const routePath = prefix + layer.route.path;
        const methods = Object.keys(layer.route.methods)
          .filter((m) => layer.route.methods[m])
          .map((m) => m.toUpperCase());

        routes.push({
          methods,
          path: routePath,
          prefix,
          source_type: 'express_route',
          schema_fields: [],
          sample_response: null
        });
      } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
        let routerPrefix = prefix;
        if (layer.regexp) {
          const match = layer.regexp.source
            .replace('^\\', '')
            .replace('\\/?(?=\\/|$)', '')
            .replace('?(?=\\/|$)', '')
            .replace(/\\\//g, '/')
            .replace('(?=\\/|$)', '')
            .replace('^', '')
            .replace('$', '');
          if (match && !match.includes('.*')) {
            routerPrefix = prefix + match;
          }
        }
        extractRoutes(layer.handle.stack, routerPrefix);
      }
    }
  }

  if (app._router && app._router.stack) {
    extractRoutes(app._router.stack);
  }

  // Deduplicate and sort
  const uniqueMap = new Map();
  for (const r of routes) {
    for (const method of r.methods) {
      const key = `${method} ${r.path}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, {
          method,
          path: r.path,
          schema_fields: r.schema_fields,
          sample_response: r.sample_response
        });
      }
    }
  }

  const sortedRoutes = Array.from(uniqueMap.values()).sort((a, b) => {
    if (a.path === b.path) return a.method.localeCompare(b.method);
    return a.path.localeCompare(b.path);
  });

  fs.writeFileSync(OUT_FILE, JSON.stringify(sortedRoutes, null, 2), 'utf-8');
  console.log(`Generated ${OUT_FILE} with ${sortedRoutes.length} Node routes.`);
}

generate().catch((err) => {
  console.error('Error generating routes-node.json:', err);
  process.exit(1);
});
