import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existing) throw new ConflictException('Email is already registered');

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        name: dto.name,
        company: dto.company,
        passwordHash: await bcrypt.hash(dto.password, 12)
      }
    });
    return this.issueToken(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    const sentinel = '$2a$12$invalidhashfortimingnormalization000000000000000000000u';
    const valid = await bcrypt.compare(dto.password, user?.passwordHash ?? sentinel);
    if (!user || !valid) throw new UnauthorizedException('Invalid credentials');
    return this.issueToken(user);
  }

  private issueToken(user: { id: string; email: string; name: string | null; company: string | null; role: string }) {
    return {
      accessToken: this.jwt.sign({ sub: user.id, email: user.email, role: user.role }),
      user: { id: user.id, email: user.email, name: user.name, company: user.company, role: user.role }
    };
  }
}
