import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AccessTokenPayload } from '../../auth/auth.service';

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AccessTokenPayload => {
  const req = ctx.switchToHttp().getRequest<Request & { user: AccessTokenPayload }>();
  return req.user;
});
