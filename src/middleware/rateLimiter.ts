import rateLimit from 'express-rate-limit';

export const rateLimiter = rateLimit({
  windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000'), // 15 minutos
  max: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100'), // máximo 100 requests por IP
  message: {
    success: false,
    error: 'Muitas requisições. Tente novamente em alguns minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
}); 