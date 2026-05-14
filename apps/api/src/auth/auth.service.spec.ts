import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

const makeUser = (overrides = {}) => ({
  id: 'u1',
  email: 'test@example.com',
  name: 'Test',
  company: null,
  role: 'USER',
  passwordHash: '',
  createdAt: new Date(),
  updatedAt: new Date(),
  audits: [],
  ...overrides
});

describe('AuthService', () => {
  let svc: AuthService;
  let prisma: any;
  let jwtService: JwtService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn()
      }
    };
    jwtService = { sign: jest.fn().mockReturnValue('jwt-token') } as any;
    svc = new AuthService(prisma, jwtService);
  });

  describe('register', () => {
    it('creates user and returns token on success', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const hash = await bcrypt.hash('password123', 12);
      const user = makeUser({ passwordHash: hash });
      prisma.user.create.mockResolvedValue(user);

      const result = await svc.register({ email: 'Test@Example.com', password: 'password123' });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
      expect(result.accessToken).toBe('jwt-token');
      expect(result.user.email).toBe('test@example.com');
    });

    it('throws ConflictException when email already registered', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      await expect(svc.register({ email: 'test@example.com', password: 'password123' })).rejects.toThrow(ConflictException);
    });

    it('lowercases the email before lookup and create', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(makeUser());
      await svc.register({ email: 'UPPER@EXAMPLE.COM', password: 'password123' });
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ email: 'upper@example.com' }) })
      );
    });
  });

  describe('login', () => {
    it('returns token for correct credentials', async () => {
      const hash = await bcrypt.hash('correct-password', 12);
      prisma.user.findUnique.mockResolvedValue(makeUser({ passwordHash: hash }));

      const result = await svc.login({ email: 'test@example.com', password: 'correct-password' });
      expect(result.accessToken).toBe('jwt-token');
    });

    it('throws UnauthorizedException for wrong password', async () => {
      const hash = await bcrypt.hash('correct-password', 12);
      prisma.user.findUnique.mockResolvedValue(makeUser({ passwordHash: hash }));

      await expect(svc.login({ email: 'test@example.com', password: 'wrong-password' })).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user not found (and does not short-circuit timing)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      // Must still run bcrypt.compare (sentinel path) — just verify it throws, not that it's fast
      await expect(svc.login({ email: 'nobody@example.com', password: 'any' })).rejects.toThrow(UnauthorizedException);
    });

    it('lowercases email on lookup', async () => {
      const hash = await bcrypt.hash('pw', 12);
      prisma.user.findUnique.mockResolvedValue(makeUser({ passwordHash: hash }));
      await svc.login({ email: 'TEST@EXAMPLE.COM', password: 'pw' });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
    });
  });
});
