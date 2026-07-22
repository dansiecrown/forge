import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
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
  intercept(context: ExecutionContext, next: CallHandler): Observable<SuccessEnvelope<unknown>> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    return next.handle().pipe(
      map((result: unknown) => {
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
