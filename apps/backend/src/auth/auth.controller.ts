import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService, AccessTokenPayload } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from '../common/decorators/public.decorator';
import { parseDurationMs } from '../common/duration';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } =
      await this.authService.login(dto);
    this.setAuthCookies(res, accessToken, refreshToken);
    return { user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.['refresh_token'] as string | undefined;
    if (!token) throw new UnauthorizedException();

    const { accessToken, refreshToken } = await this.authService.refresh(token);
    this.setAuthCookies(res, accessToken, refreshToken);
    return { ok: true };
  }

  // Clearing this browser's cookies must also work after access/refresh expiration.
  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token', { path: '/api/auth' });
  }

  @Get('me')
  async me(@Req() req: Request & { user: AccessTokenPayload }) {
    const user = await this.authService.me(req.user.sub);
    return { user };
  }

  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    // COOKIE_SECURE=false — для деплоя без HTTPS (по IP), иначе браузер не сохранит куки
    const cookieSecure = this.config.get<string>('COOKIE_SECURE');
    const secure =
      cookieSecure !== undefined
        ? cookieSecure === 'true'
        : this.config.get<string>('NODE_ENV') === 'production';

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      maxAge: parseDurationMs(this.config.get<string>('ACCESS_TTL') ?? '15m'),
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/api/auth',
      maxAge: parseDurationMs(this.config.get<string>('REFRESH_TTL') ?? '30d'),
    });
  }
}
