import dotenv from 'dotenv';
dotenv.config();

export const config = {
  projectName: process.env.PROJECT_NAME || 'AstroCare v2 Backend',
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8000', 10),
  apiV1Prefix: '/api/v1',

  // MongoDB
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27018/astrocare',

  // Security & Secrets
  jwtSecret: process.env.JWT_SECRET || 'change_this_to_a_secure_random_key_min_32_bytes',
  fieldEncryptionKey: process.env.FIELD_ENCRYPTION_KEY || 'MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=',

  // CORS
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173,http://localhost:8000')
    .split(',')
    .map((o) => o.trim()),

  // Rate Limiting
  rateLimitMax: parseInt(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE || '120', 10),

  // Feature Flags
  flagEnableMl: process.env.FLAG_ENABLE_ML !== 'false',
  flagEnableLocalLlm: process.env.FLAG_ENABLE_LOCAL_LLM === 'true',
  flagMissionMode: process.env.FLAG_MISSION_MODE || 'ISS'
};
