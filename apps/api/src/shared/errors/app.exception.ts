import { HttpException, HttpStatus } from '@nestjs/common';

export interface ErrorDetail {
  field?: string;
  code: string;
  message: string;
}

interface AppExceptionPayload {
  code: string;
  message: string;
  details?: ErrorDetail[];
}

/** Domain exception whose shape matches the API spec's error envelope
 * (`code`, `message`, `details`). The exception filter adds `requestId`. */
export class AppException extends HttpException {
  constructor(status: HttpStatus, code: string, message: string, details?: ErrorDetail[]) {
    const payload: AppExceptionPayload = { code, message, ...(details ? { details } : {}) };
    super(payload, status);
  }

  static unauthenticated(
    message = 'Authentication is required.',
    code = 'UNAUTHENTICATED',
  ): AppException {
    return new AppException(HttpStatus.UNAUTHORIZED, code, message);
  }

  static invalidCredentials(): AppException {
    return new AppException(
      HttpStatus.UNAUTHORIZED,
      'INVALID_CREDENTIALS',
      'Invalid email or password.',
    );
  }

  static forbidden(message = 'You do not have permission to perform this action.'): AppException {
    return new AppException(HttpStatus.FORBIDDEN, 'PERMISSION_DENIED', message);
  }

  static notFound(message = 'The requested resource was not found.'): AppException {
    return new AppException(HttpStatus.NOT_FOUND, 'NOT_FOUND', message);
  }

  static conflict(code: string, message: string): AppException {
    return new AppException(HttpStatus.CONFLICT, code, message);
  }

  static validation(details: ErrorDetail[]): AppException {
    return new AppException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'VALIDATION_ERROR',
      'The request contains invalid fields.',
      details,
    );
  }

  static rateLimited(message = 'Too many requests. Please try again later.'): AppException {
    return new AppException(HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMITED', message);
  }

  static gone(code: string, message: string): AppException {
    return new AppException(HttpStatus.GONE, code, message);
  }
}
