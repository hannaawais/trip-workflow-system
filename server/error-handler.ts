import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Common error types with user-friendly messages
export const ErrorMessages = {
  // Authentication errors
  UNAUTHORIZED: "Please log in to access this feature",
  FORBIDDEN: "You don't have permission to perform this action",
  INVALID_CREDENTIALS: "Invalid username or password",
  SESSION_EXPIRED: "Your session has expired. Please log in again",

  // Validation errors
  INVALID_INPUT: "Please check your input and try again",
  MISSING_REQUIRED_FIELDS: "Please fill in all required fields",
  INVALID_DATE: "Please enter a valid date",
  INVALID_EMAIL: "Please enter a valid email address",
  INVALID_FILE_TYPE: "Please upload a valid file (PDF, JPG, PNG)",
  FILE_TOO_LARGE: "File size must be less than 10MB",

  // Business logic errors
  BUDGET_EXCEEDED: "Trip cost exceeds available project budget",
  DUPLICATE_REQUEST: "A similar request already exists",
  INVALID_STATUS_TRANSITION: "Cannot change status at this time",
  DEADLINE_PASSED: "Request deadline has passed",
  INSUFFICIENT_PERMISSIONS: "You don't have permission for this action",

  // Database errors
  RECORD_NOT_FOUND: "The requested item was not found",
  DUPLICATE_ENTRY: "This entry already exists",
  DATABASE_ERROR: "A system error occurred. Please try again",

  // Network/System errors
  NETWORK_ERROR: "Network error. Please check your connection",
  SERVER_ERROR: "A system error occurred. Please try again later",
  SERVICE_UNAVAILABLE: "Service is temporarily unavailable"
};



export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log error for debugging (in development)
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', err);
  }

  // If it's already an AppError, handle it directly
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message
    });
  }

  let error = err;

  // Mongoose/Database validation error
  if (err.name === 'ValidationError') {
    const message = ErrorMessages.INVALID_INPUT;
    error = new AppError(message, 400);
  }

  // Mongoose duplicate key error
  if ((err as any).code === 11000) {
    const message = ErrorMessages.DUPLICATE_ENTRY;
    error = new AppError(message, 400);
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = ErrorMessages.RECORD_NOT_FOUND;
    error = new AppError(message, 404);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = ErrorMessages.UNAUTHORIZED;
    error = new AppError(message, 401);
  }

  if (err.name === 'TokenExpiredError') {
    const message = ErrorMessages.SESSION_EXPIRED;
    error = new AppError(message, 401);
  }

  // Database connection errors
  if (err.message?.includes('connection') || err.message?.includes('ECONNREFUSED')) {
    const message = ErrorMessages.DATABASE_ERROR;
    error = new AppError(message, 500);
  }

  // File upload errors
  if (err.message?.includes('File too large')) {
    const message = ErrorMessages.FILE_TOO_LARGE;
    error = new AppError(message, 400);
  }

  // Handle AppError properly
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message
    });
  }

  // Default to server error for unknown errors
  const appError = new AppError(ErrorMessages.SERVER_ERROR, 500);
  res.status(500).json({
    success: false,
    error: appError.message
  });
};

// Async error wrapper
export const catchAsync = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
};

// Create specific error types
export const createValidationError = (message: string) => new AppError(message, 400);
export const createNotFoundError = (resource?: string) => new AppError(resource ? `${resource} not found` : ErrorMessages.RECORD_NOT_FOUND, 404);
export const createUnauthorizedError = (message?: string) => new AppError(message || ErrorMessages.UNAUTHORIZED, 401);
export const createForbiddenError = (message?: string) => new AppError(message || ErrorMessages.FORBIDDEN, 403);
export const createBadRequestError = (message?: string) => new AppError(message || ErrorMessages.INVALID_INPUT, 400);
export const createBudgetError = (excess: number) => 
  new AppError(`${ErrorMessages.BUDGET_EXCEEDED}. Excess amount: ${excess.toFixed(2)} JD`, 400);