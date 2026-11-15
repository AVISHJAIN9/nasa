import crypto from 'crypto';
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label })
  }
});

export function requestLoggingMiddleware(req, res, next) {
  const reqId = req.headers['x-request-id'] || `req-${crypto.randomBytes(6).toString('hex')}`;
  req.id = reqId;
  res.setHeader('X-Request-ID', reqId);

  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      requestId: reqId,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs: duration
    });
  });

  next();
}
