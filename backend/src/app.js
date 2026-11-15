import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import { config } from './config/index.js';
import { requestLoggingMiddleware } from './middleware/logging.js';
import { errorHandler } from './middleware/errors.js';
import { autoLoad } from './loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createApp() {
  const app = express();

  // Standard Security & Performance Middleware
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
      exposedHeaders: ['X-Request-ID', 'Retry-After']
    })
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(requestLoggingMiddleware);

  // Rate Limiting (Token Bucket / Sliding Window equivalent via express-rate-limit)
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      const requestId = req.id || 'req-unknown';
      res.setHeader('Retry-After', '60');
      return res.status(429).json({
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded. Please back off.',
        details: { retry_after: 60 },
        requestId,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded. Please back off.',
          details: { retry_after: 60 },
          request_id: requestId
        }
      });
    }
  });
  app.use('/api/', limiter);

  // 1. Auto-load Models
  const modelsDir = path.join(__dirname, 'models');
  await autoLoad(modelsDir, () => {});

  // 2. Auto-load Routes
  const routesDir = path.join(__dirname, 'routes');
  await autoLoad(routesDir, (module) => {
    if (module.default) {
      app.use('/', module.default);
    }
  });

  // 3. Auto-load Workers
  const workersDir = path.join(__dirname, 'workers');
  await autoLoad(workersDir, () => {});

  // 4. Global Error Handling (One error JSON shape for all routes)
  app.use(errorHandler);

  return app;
}
