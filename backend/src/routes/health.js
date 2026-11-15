import { Router } from 'express';
import mongoose from 'mongoose';
import { config } from '../config/index.js';

const router = Router();
const startTime = Date.now();

router.get(['/health', '/api/v1/health'], async (req, res) => {
  const isMongoConnected = mongoose.connection.readyState === 1;
  // Liveness must stay available when optional Python/ML is not deployed.
  const status = isMongoConnected ? 'healthy' : 'degraded';

  return res.status(200).json({
    status,
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
    environment: config.env,
    version: '0.1.0',
    components: {
      mongodb: isMongoConnected ? 'connected' : 'disconnected',
      ml: 'not_deployed'
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
