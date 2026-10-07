import 'reflect-metadata';
import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

// Unit-test configuration is supplied below; do not load environment files.
jest.mock('@nestjs/config', () => ({ ConfigService: jest.fn() }));

describe('AuthController logout', () => {
  const config = { get: jest.fn() } as unknown as ConfigService;
  const guard = new JwtAuthGuard(new Reflector(), config);

  function context(method: 'logout' | 'me'): ExecutionContext {
    return {
      // The guard reads decorator metadata; it never invokes this method.
      // eslint-disable-next-line @typescript-eslint/unbound-method
      getHandler: () => AuthController.prototype[method],
      getClass: () => AuthController,
      switchToHttp: () => ({ getRequest: () => ({ cookies: {} }) }),
    } as unknown as ExecutionContext;
  }

  it('allows logout without a valid token and clears both cookie paths', () => {
    expect(guard.canActivate(context('logout'))).toBe(true);
    const clearCookie = jest.fn();
    const controller = new AuthController({} as AuthService, config);
    controller.logout({ clearCookie } as unknown as Response);
    expect(clearCookie).toHaveBeenCalledWith('access_token');
    expect(clearCookie).toHaveBeenCalledWith('refresh_token', {
      path: '/api/auth',
    });
  });

  it('still requires authentication for the current-user endpoint', () => {
    expect(() => guard.canActivate(context('me'))).toThrow(
      UnauthorizedException,
    );
  });
});
