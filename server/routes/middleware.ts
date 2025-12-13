import type { Request, Response, NextFunction, RequestHandler } from "express";
import { logBuffer } from "../services/log-buffer";

export type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void | Response>;

export function asyncHandler(fn: AsyncHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Comprehensive API error logging utility.
 * Logs detailed error context for debugging and monitoring.
 */
function logApiError(
  err: Error & { status?: number },
  req: Request,
  context?: string
): void {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl || req.url;
  const status = err.status || 500;
  
  // Build error log object for structured logging
  const errorLog = {
    timestamp,
    level: status >= 500 ? "ERROR" : "WARN",
    type: err.name || "Error",
    message: err.message,
    status,
    method,
    url,
    params: Object.keys(req.params).length > 0 ? req.params : undefined,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    body: req.body && Object.keys(req.body).length > 0 
      ? sanitizeBody(req.body) 
      : undefined,
    context,
    stack: err.stack,
  };
  
  // Log structured error
  console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.error(`[${errorLog.level}] API Error at ${timestamp}`);
  console.error(`  Endpoint: ${method} ${url}`);
  console.error(`  Status: ${status}`);
  console.error(`  Type: ${errorLog.type}`);
  console.error(`  Message: ${errorLog.message}`);
  if (errorLog.params) {
    console.error(`  Params:`, JSON.stringify(errorLog.params));
  }
  if (errorLog.query) {
    console.error(`  Query:`, JSON.stringify(errorLog.query));
  }
  if (errorLog.body) {
    console.error(`  Body:`, JSON.stringify(errorLog.body));
  }
  if (context) {
    console.error(`  Context: ${context}`);
  }
  if (err.stack) {
    console.error(`  Stack Trace:\n${err.stack}`);
  }
  console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  // Also log to the in-memory buffer for debug UI access
  logBuffer.error(
    `[${method}] ${url} - ${errorLog.message}`,
    JSON.stringify({
      status,
      type: errorLog.type,
      params: errorLog.params,
      query: errorLog.query,
      body: errorLog.body,
      stack: err.stack?.split('\n').slice(0, 5).join('\n'),
    }, null, 2)
  );
}

/**
 * Sanitizes request body for logging by redacting sensitive fields.
 */
function sanitizeBody(body: Record<string, any>): Record<string, any> {
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'authorization', 'credential'];
  const sanitized = { ...body };
  
  for (const field of sensitiveFields) {
    for (const key of Object.keys(sanitized)) {
      if (key.toLowerCase().includes(field.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      }
    }
  }
  
  // Truncate very large fields (like base64 data)
  for (const key of Object.keys(sanitized)) {
    if (typeof sanitized[key] === 'string' && sanitized[key].length > 500) {
      sanitized[key] = `[TRUNCATED: ${sanitized[key].length} chars]`;
    }
  }
  
  return sanitized;
}

export function errorHandler(
  err: Error & { status?: number },
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log comprehensive error details
  logApiError(err, req);
  
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || "Internal server error",
  });
}

/**
 * Utility to log errors in integration functions with context.
 * Use this in try/catch blocks within integrations.
 */
export function logIntegrationError(
  error: Error,
  integrationName: string,
  operation: string,
  details?: Record<string, any>
): void {
  const timestamp = new Date().toISOString();
  
  console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.error(`[ERROR] Integration Error at ${timestamp}`);
  console.error(`  Integration: ${integrationName}`);
  console.error(`  Operation: ${operation}`);
  console.error(`  Type: ${error.name || 'Error'}`);
  console.error(`  Message: ${error.message}`);
  if (details) {
    console.error(`  Details:`, JSON.stringify(details));
  }
  if (error.stack) {
    console.error(`  Stack Trace:\n${error.stack}`);
  }
  console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  // Also log to the in-memory buffer for debug UI access
  logBuffer.error(
    `[${integrationName}] ${operation} - ${error.message}`,
    JSON.stringify({ details, stack: error.stack?.split('\n').slice(0, 5).join('\n') }, null, 2)
  );
}

export function createApiError(message: string, status: number): Error & { status: number } {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}

export const badRequest = (message: string) => createApiError(message, 400);
export const notFound = (message: string) => createApiError(message, 404);
export const serverError = (message: string) => createApiError(message, 500);
