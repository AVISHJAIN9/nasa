import { Router } from 'express';
import mongoose from 'mongoose';
import { config } from '../config/index.js';

const router = Router();
const startTime = Date.now();

router.get('/health', async (req, res) => {
  const isMongoConnected = mongoose.connection.readyState === 1;
  const status = isMongoConnected ? 'healthy' : 'degraded';
  const statusCode = isMongoConnected ? 200 : 503;

  return res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
    environment: config.env,
    version: '0.1.0',
    components: {
      database: isMongoConnected ? 'connected' : 'disconnected',
      mongodb: isMongoConnected ? 'connected' : 'disconnected'
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
