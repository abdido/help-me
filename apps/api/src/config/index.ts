import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  trustedProxies: (process.env.TRUSTED_PROXY || '').split(',').map((proxy) => proxy.trim()).filter(Boolean),
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production-min-32-chars!!',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },
  database: {
    url: process.env.DATABASE_URL || '',
  },
  emailPasswordResetEnabled: process.env.EMAIL_PASSWORD_RESET_ENABLED === 'true',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.SMTP_FROM || '',
  },
  passwordResetUrl: process.env.PASSWORD_RESET_URL || 'http://localhost:5174/reset-password',
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
};

if (config.nodeEnv === 'production') {
  if (
    config.jwt.secret.length < 32 ||
    config.jwt.secret.startsWith('dev-secret') ||
    config.jwt.secret === 'change-this-to-a-random-secret-min-32-chars'
  ) {
    throw new Error('JWT_SECRET must be a unique secret of at least 32 characters in production');
  }
  if (!config.database.url) {
    throw new Error('DATABASE_URL is required in production');
  }
  if (config.emailPasswordResetEnabled &&
      (!config.smtp.host || !config.smtp.from || !process.env.PASSWORD_RESET_URL)) {
    throw new Error('SMTP_HOST, SMTP_FROM, and PASSWORD_RESET_URL are required for email password reset');
  }
}
