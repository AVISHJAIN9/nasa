import { Router } from 'express';
import mongoose from 'mongoose';
import { config } from '../config/index.js';

const router = Router();
const startTime = Date.now();

router.get(['/health', '/api/v1/health'], async (req, res) => {
  const isMongoConnected = mongoose.connection.readyState === 1;
  const fastApiUrl = process.env.FASTAPI_URL || 'http://localhost:8001';
  let isFastApiUp = false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 600);
    const resp = await fetch(`${fastApiUrl}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    isFastApiUp = resp.ok;
  } catch {
    isFastApiUp = false;
  }

  const status = isMongoConnected ? (isFastApiUp ? 'healthy' : 'degraded') : 'unhealthy';
  const statusCode = isMongoConnected ? 200 : 503;

  return res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
    environment: config.env,
    version: '0.1.0',
    components: {
      mongodb: isMongoConnected ? 'connected' : 'disconnected',
      fastapi: isFastApiUp ? 'connected' : 'disconnected'
    }
  });
});

router.get('/metrics', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  return res.send(
    `# HELP astrocare_uptime_seconds System uptime in seconds\n` +
      `# TYPE astrocare_uptime_seconds gauge\n` +
      `astrocare_uptime_seconds ${Math.floor((Date.now() - startTime) / 1000)}\n` +
      `# HELP astrocare_mongodb_connected Status of MongoDB connection\n` +
      `# TYPE astrocare_mongodb_connected gauge\n` +
      `astrocare_mongodb_connected ${mongoose.connection.readyState === 1 ? 1 : 0}\n`
  );
});

export default router;
