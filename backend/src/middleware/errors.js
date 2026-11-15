import { ZodError } from 'zod';

export class AppException extends Error {
  constructor(code, message, statusCode = 400, details = {}) {
    super(message);
    this.name = 'AppException';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class BadRequestException extends AppException {
  constructor(message = 'Bad request', details = {}) {
    super('BAD_REQUEST', message, 400, details);
  }
}

export class UnauthorizedException extends AppException {
  constructor(message = 'Authentication required or invalid token', details = {}) {
    super('UNAUTHORIZED', message, 401, details);
  }
}

export class ForbiddenException extends AppException {
  constructor(message = 'Access denied for current role or identity', details = {}) {
    super('FORBIDDEN', message, 403, details);
  }
}

export class NotFoundException extends AppException {
  constructor(message = 'Resource not found', details = {}) {
    super('NOT_FOUND', message, 404, details);
  }
}

export class ConflictException extends AppException {
  constructor(message = 'Resource conflict or duplicate entry', details = {}) {
    super('CONFLICT', message, 409, details);
  }
}

export class RateLimitExceededException extends AppException {
  constructor(message = 'Rate limit exceeded. Please back off.', retryAfter = 60, details = {}) {
    super('RATE_LIMIT_EXCEEDED', message, 429, { ...details, retry_after: retryAfter });
    this.retryAfter = retryAfter;
  }
}

export class FeatureDisabledException extends AppException {
  constructor(flagName, message = null) {
    super('FEATURE_DISABLED', message || `Feature '${flagName}' is currently disabled.`, 403, { flag: flagName });
  }
}

export class InternalServerErrorException extends AppException {
  constructor(message = 'An unexpected internal server error occurred', details = {}) {
    super('INTERNAL_SERVER_ERROR', message, 500, details);
  }
}

export class ServiceUnavailableException extends AppException {
  constructor(message = 'Service or dependency temporarily unavailable', details = {}) {
    super('SERVICE_UNAVAILABLE', message, 503, details);
  }
}

export function errorHandler(err, req, res, _next) {
  const requestId = req.id || req.headers['x-request-id'] || 'req-unknown';
  res.setHeader('X-Request-ID', requestId);

  // 1. Zod Validation Error (HTTP 422)
  if (err instanceof ZodError) {
    const cleanErrors = err.errors.map((e) => ({
      loc: e.path,
      msg: e.message,
      type: e.code
    }));

    return res.status(422).json({
      code: 'VALIDATION_ERROR',
      message: 'Request payload failed schema validation',
      details: { validation_errors: cleanErrors },
      requestId,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request payload failed schema validation',
        details: { validation_errors: cleanErrors },
        request_id: requestId
      }
    });
  }

  // 2. Known AppException
  if (err instanceof AppException) {
    if (err instanceof RateLimitExceededException && err.retryAfter) {
      res.setHeader('Retry-After', String(err.retryAfter));
    }
    if (err instanceof UnauthorizedException) {
      res.setHeader('WWW-Authenticate', 'Bearer');
    }

    return res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
      details: err.details,
      requestId,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        request_id: requestId
      }
    });
  }

  // 3. Fallback for unhandled exceptions (HTTP 500) - NEVER leak stack traces
  console.error(`[UnhandledError] ${req.method} ${req.url} [requestId=${requestId}]:`, err);
  return res.status(500).json({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An internal server error occurred. Please contact mission control with the request_id.',
    details: {},
    requestId,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An internal server error occurred. Please contact mission control with the request_id.',
      details: {},
      request_id: requestId
    }
  });
}
