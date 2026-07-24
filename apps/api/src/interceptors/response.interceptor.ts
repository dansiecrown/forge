import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Response } from 'express';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { AuthenticatedRequest } from '../shared/http/authenticated-request';
import { CollectionResult } from '../shared/pagination/collection-result';

interface SuccessEnvelope<T> {
  data: T;
  meta: Record<string, unknown>;
}

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<SuccessEnvelope<unknown> | undefined> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((result: unknown) => {
        // A 204 has no representation (api-specification.md §2) — don't wrap
        // undefined into a JSON body for handlers that intentionally return
        // nothing (reset-password, verify-email, session/role revocation, …).
        if (response.statusCode === 204) {
          return undefined;
        }

        const meta: Record<string, unknown> = { requestId: request.requestId };

        if (result instanceof CollectionResult) {
          meta.page = result.page;
          return { data: result.items, meta };
        }

        return { data: result, meta };
      }),
    );
  }
}
