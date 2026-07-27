import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../common/prisma';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {
    const secret = configService.get<string>('jwt.secret');
    if (!secret) {
      throw new Error('JWT_SECRET is required');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.prismaService.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException();
    }

    // Load fresh role names from the database on every request
    // This ensures any role changes are reflected immediately
    const member = await this.prismaService.companyMember.findFirst({
      where: {
        userId: payload.userId,
        companyId: payload.companyId,
        deletedAt: null,
      },
      select: {
        id: true,
        userRoles: {
          include: {
            role: {
              select: { name: true },
            },
          },
        },
      },
    });

    const roles = member ? member.userRoles.map((ur) => ur.role.name) : [];

    return {
      ...payload,
      roles,
    };
  }
}
