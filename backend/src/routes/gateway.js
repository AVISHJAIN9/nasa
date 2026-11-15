import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config/index.js';
import {
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  RateLimitExceededException,
  FeatureDisabledException,
  InternalServerErrorException,
  ServiceUnavailableException
} from '../middleware/errors.js';

const router = Router();

router.get('/api/v1/gateway/info', (req, res) => {
  return res.json({
    project_name: config.projectName,
    api_version: 'v1',
    environment: config.env,
    docs_url: '/docs',
    openapi_url: '/openapi.json',
    contracts_file: 'build/CONTRACTS.md',
    supported_error_codes: [
      'VALIDATION_ERROR',
      'BAD_REQUEST',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'NOT_FOUND',
      'CONFLICT',
      'RATE_LIMIT_EXCEEDED',
      'FEATURE_DISABLED',
      'INTERNAL_SERVER_ERROR',
      'SERVICE_UNAVAILABLE'
    ]
  });
});

const validationSchema = z.object({
  age: z.number().int().min(18).max(120),
  crew_id: z.string().min(4).max(16)
});

router.post('/api/v1/gateway/test-validation', (req, res, next) => {
  try {
    const validated = validationSchema.parse(req.body);
    return res.json({ message: 'Payload is valid', data: validated });
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/gateway/test-error/:code', (req, res, next) => {
  const code = (req.params.code || '').toUpperCase();
  if (code === 'BAD_REQUEST') {
    return next(new BadRequestException('Simulated bad request error'));
  } else if (code === 'UNAUTHORIZED') {
    return next(new UnauthorizedException('Simulated unauthorized error'));
  } else if (code === 'FORBIDDEN') {
    return next(new ForbiddenException('Simulated forbidden error'));
  } else if (code === 'NOT_FOUND') {
    return next(new NotFoundException('Simulated resource not found'));
  } else if (code === 'CONFLICT') {
    return next(new ConflictException('Simulated resource conflict'));
  } else if (code === 'RATE_LIMIT_EXCEEDED') {
    return next(new RateLimitExceededException('Simulated rate limit exceeded', 30));
  } else if (code === 'FEATURE_DISABLED') {
    return next(new FeatureDisabledException('test_flag', 'Simulated feature disabled'));
  } else if (code === 'SERVICE_UNAVAILABLE') {
    return next(new ServiceUnavailableException('Simulated service unavailable'));
  } else if (code === 'INTERNAL_SERVER_ERROR') {
    return next(new InternalServerErrorException('Simulated internal server error'));
  } else if (code === 'UNHANDLED') {
    throw new Error('Raw unhandled server exception!');
  } else {
    return next(new BadRequestException(`Unknown test error code: ${code}`));
  }
});

export default router;
