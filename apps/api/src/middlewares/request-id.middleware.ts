import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { AuthenticatedRequest } from '../shared/http/authenticated-request';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header('X-Request-Id');
    const requestId = incoming && incoming.trim().length > 0 ? incoming : `req_${randomUUID()}`;
    (req as AuthenticatedRequest).requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
  }
}
