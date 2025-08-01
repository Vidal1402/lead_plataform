import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';

export const initSentry = () => {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      integrations: [
        new ProfilingIntegration(),
      ],
      tracesSampleRate: 1.0,
      profilesSampleRate: 1.0,
      environment: process.env.NODE_ENV || 'development',
    });
  }
};

export const captureException = (error: Error, context?: any) => {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, {
      extra: context,
    });
  }
};

export const captureMessage = (message: string, level: Sentry.SeverityLevel = 'info') => {
  if (process.env.SENTRY_DSN) {
    Sentry.captureMessage(message, {
      level,
    });
  }
}; 