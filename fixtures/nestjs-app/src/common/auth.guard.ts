import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

// A fixed token keeps the fixture self-contained; the guard exists so the
// map has a guard step before the controller, as in the PRD example.
export const FIXTURE_TOKEN = 'fixture-token';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    return request.headers.authorization === `Bearer ${FIXTURE_TOKEN}`;
  }
}
