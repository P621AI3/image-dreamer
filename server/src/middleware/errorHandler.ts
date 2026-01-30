import { ErrorRequestHandler } from 'express';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'TRANSCRIPTION_FAILED'
  | 'GENERATION_FAILED'
  | 'VIDEO_GENERATION_FAILED'
  | 'CONFIG_ERROR'
  | 'INTERNAL_ERROR';

export class ApiError extends Error {
  statusCode: number;
  code: ErrorCode;

  constructor(message: string, statusCode: number, code: ErrorCode) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function createApiError(
  message: string,
  statusCode: number,
  code: ErrorCode = 'INTERNAL_ERROR',
): ApiError {
  return new ApiError(message, statusCode, code);
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const isApiError = err instanceof ApiError;
  const statusCode = isApiError ? err.statusCode : 500;
  const code: ErrorCode = isApiError ? err.code : 'INTERNAL_ERROR';
  const message = isApiError ? err.message : 'Internal server error';

  const timestamp = new Date().toISOString();
  console.error(
    `[${timestamp}] ${req.method} ${req.path} -> ${statusCode} ${code}: ${message}`,
  );
  if (statusCode >= 500) {
    console.error(err.stack);
  }

  res.status(statusCode).json({ error: message, code });
};
