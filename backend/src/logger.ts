export interface LogContext {
  [key: string]: unknown;
}

const LEVELS: Record<string, number> = { error: 0, warn: 1, info: 2 };

function shouldLog(level: string): boolean {
  const logLevel = process.env.CIVICFEED_LOG_LEVEL || "info";
  if (logLevel === "silent") return false;
  return (LEVELS[level] ?? 2) <= (LEVELS[logLevel] ?? 2);
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return { value: error };
}

function log(level: string, message: string, context: LogContext = {}) {
  if (!shouldLog(level)) return;

  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };

  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else if (level === "warn") {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  info: (message: string, context?: LogContext) => log("info", message, context),
  warn: (message: string, context?: LogContext) => log("warn", message, context),
  error: (message: string, error?: unknown, context?: LogContext) =>
    log("error", message, { error: error ? serializeError(error) : undefined, ...context }),
};
