import type { ValidationError } from '@nestjs/common';
import { AppException, type ErrorDetail } from '../errors/app.exception';

function flatten(errors: ValidationError[], parentPath = ''): ErrorDetail[] {
  return errors.flatMap((error) => {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;

    if (error.children && error.children.length > 0) {
      return flatten(error.children, path);
    }

    const constraints = error.constraints ?? {};
    return Object.entries(constraints).map(([constraintKey, message]) => ({
      field: path,
      code: constraintKey.toUpperCase(),
      message,
    }));
  });
}

export function validationExceptionFactory(errors: ValidationError[]): AppException {
  return AppException.validation(flatten(errors));
}
