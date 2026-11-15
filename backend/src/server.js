import http from 'http';
import mongoose from 'mongoose';
import { Server as SocketIOServer } from 'socket.io';

import { config } from './config/index.js';
import { createApp } from './app.js';
import { eventBus } from './bus/index.js';
import { logger } from './middleware/logging.js';
import { initializeDefaultFlags } from './services/flagService.js';

async function startServer() {
  try {
    logger.info(`Connecting to MongoDB at ${config.mongodbUri}...`);
    await mongoose.connect(config.mongodbUri);
    logger.info('MongoDB connected successfully.');

    // Seed initial default feature flags
    await initializeDefaultFlags();
    logger.info('Default feature flags initialized.');

    const app = await createApp();
    const server = http.createServer(app);

    // Socket.IO Integration
    const io = new SocketIOServer(server, {
      cors: {
        origin: config.corsOrigins,
        methods: ['GET', 'POST']
      }
    });
    eventBus.setSocketIO(io);

    server.listen(config.port, () => {
      logger.info(`AstroCare v2 MERN backend listening on port ${config.port} (${config.env})`);
    });

    return server;
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
