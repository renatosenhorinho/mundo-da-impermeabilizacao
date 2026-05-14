export const LogLevel = {
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
} as const;

type LogLevelType = typeof LogLevel[keyof typeof LogLevel];

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isDev = import.meta.env.DEV;

  private formatMessage(level: LogLevelType, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message} ${context ? JSON.stringify(context) : ''}`;
  }

  info(message: string, context?: LogContext) {
    if (this.isDev) {
      console.info(this.formatMessage(LogLevel.INFO, message, context));
    }
  }

  warn(message: string, context?: LogContext) {
    if (this.isDev) {
      console.warn(this.formatMessage(LogLevel.WARN, message, context));
    } else {
      // In production, we might want to track warnings if they are critical
      this.captureMessage(message, LogLevel.WARN, context);
    }
  }

  error(error: Error | string, context?: LogContext) {
    const message = error instanceof Error ? error.message : error;

    if (this.isDev) {
      console.error(this.formatMessage(LogLevel.ERROR, message, context), error instanceof Error ? error.stack : '');
    }

    this.captureException(error, context);
  }

  // Sentry-like API for future drop-in replacement
  captureException(error: Error | unknown, context?: LogContext) {
    if (this.isDev) return;

    // TODO: Send to Sentry or internal logging endpoint
    // Sentry.captureException(error, { extra: context });

    // Fallback simple beacon log if no Sentry
    try {
      const payload = {
        type: 'exception',
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        context,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      };

      // In a real app, send this to a /api/log endpoint
      // navigator.sendBeacon('/api/log', JSON.stringify(payload));
    } catch (e) {
      // Ignore beacon failures
    }
  }

  captureMessage(message: string, level: LogLevelType = LogLevel.INFO, context?: LogContext) {
    if (this.isDev) return;

    // TODO: Send to Sentry
    // Sentry.captureMessage(message, { level, extra: context });
  }
}

export const logger = new Logger();

// Global Unhandled Error Catchers (Observability)
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    logger.captureException(event.error, { source: 'window.onerror', message: event.message });
  });

  window.addEventListener('unhandledrejection', (event) => {
    logger.captureException(event.reason, { source: 'unhandledrejection' });
  });
}
