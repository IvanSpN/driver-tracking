import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { User, UserRole } from '../database/models/user.model';
import { LoginDto } from './dto/login.dto';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface SanitizedUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User) private readonly userModel: typeof User,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.userModel.findOne({ where: { email: dto.email } });
    if (!user || !user.isActive) throw new UnauthorizedException('Неверный email или пароль');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Неверный email или пароль');

    return this.issueTokens(user);
  }

  async refresh(refreshToken: string) {
    let payload: AccessTokenPayload;
    try {
      payload = jwt.verify(refreshToken, this.config.get<string>('JWT_REFRESH_SECRET')!) as AccessTokenPayload;
    } catch {
      throw new UnauthorizedException();
    }

    const user = await this.userModel.findByPk(payload.sub);
    if (!user || !user.isActive) throw new UnauthorizedException();

    return this.issueTokens(user);
  }

  async me(userId: string): Promise<SanitizedUser> {
    const user = await this.userModel.findByPk(userId);
    if (!user || !user.isActive) throw new UnauthorizedException();
    return this.sanitize(user);
  }

  private issueTokens(user: User) {
    const payload: AccessTokenPayload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = jwt.sign(payload, this.config.get<string>('JWT_ACCESS_SECRET')!, {
      expiresIn: this.getTtl('ACCESS_TTL', '15m'),
    });

    const refreshToken = jwt.sign(payload, this.config.get<string>('JWT_REFRESH_SECRET')!, {
      expiresIn: this.getTtl('REFRESH_TTL', '30d'),
    });

    return { accessToken, refreshToken, user: this.sanitize(user) };
  }

  // env хранит длительность строкой ('15m'/'30d'); ms.StringValue из @types/jsonwebtoken
  // не выразить для значения, пришедшего из конфига, поэтому явный escape hatch.
  private getTtl(key: 'ACCESS_TTL' | 'REFRESH_TTL', fallback: string): jwt.SignOptions['expiresIn'] {
    const value = this.config.get<string>(key) ?? fallback;
    return value as unknown as jwt.SignOptions['expiresIn'];
  }

  private sanitize(user: User): SanitizedUser {
    return { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
  }
}
