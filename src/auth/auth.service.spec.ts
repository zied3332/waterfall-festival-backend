import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { hash } from 'bcryptjs';

import { UserRole } from '../generated/prisma/enums.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  let authService: AuthService;

  const usersServiceMock = {
    findByEmail: jest.fn<UsersService['findByEmail']>(),
    findById: jest.fn<UsersService['findById']>(),
    updateLastLogin: jest.fn<UsersService['updateLastLogin']>(),
  };

  const jwtServiceMock = {
    signAsync: jest.fn<JwtService['signAsync']>(),
  };

  type UserWithPassword = NonNullable<
    Awaited<ReturnType<UsersService['findByEmail']>>
  >;

  let activeAdmin: UserWithPassword;

  beforeAll(async () => {
    activeAdmin = {
      id: 1,
      email: 'admin@waterfallfestival.com',
      passwordHash: await hash('valid-password', 4),
      firstName: 'Waterfall',
      lastName: 'Admin',
      role: UserRole.ADMIN,
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date('2026-07-01T10:00:00.000Z'),
      updatedAt: new Date('2026-07-01T10:00:00.000Z'),
    };
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersServiceMock,
        },
        {
          provide: JwtService,
          useValue: jwtServiceMock,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('should return an access token and safe user data for valid credentials', async () => {
      usersServiceMock.findByEmail.mockResolvedValue(activeAdmin);
      usersServiceMock.updateLastLogin.mockResolvedValue({
        ...activeAdmin,
        lastLoginAt: new Date(),
      });
      jwtServiceMock.signAsync.mockResolvedValue('signed-jwt-token');

      const result = await authService.login({
        email: activeAdmin.email,
        password: 'valid-password',
      });

      expect(usersServiceMock.findByEmail).toHaveBeenCalledWith(
        activeAdmin.email,
      );

      expect(usersServiceMock.updateLastLogin).toHaveBeenCalledWith(
        activeAdmin.id,
      );

      expect(jwtServiceMock.signAsync).toHaveBeenCalledWith({
        sub: activeAdmin.id,
        email: activeAdmin.email,
        role: activeAdmin.role,
      });

      expect(result).toEqual({
        accessToken: 'signed-jwt-token',
        tokenType: 'Bearer',
        user: {
          id: activeAdmin.id,
          email: activeAdmin.email,
          firstName: activeAdmin.firstName,
          lastName: activeAdmin.lastName,
          role: activeAdmin.role,
        },
      });

      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should throw UnauthorizedException when the email does not exist', async () => {
      usersServiceMock.findByEmail.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'unknown@example.com',
          password: 'some-password',
        }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));

      expect(usersServiceMock.updateLastLogin).not.toHaveBeenCalled();
      expect(jwtServiceMock.signAsync).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when the user is inactive', async () => {
      usersServiceMock.findByEmail.mockResolvedValue({
        ...activeAdmin,
        isActive: false,
      });

      await expect(
        authService.login({
          email: activeAdmin.email,
          password: 'valid-password',
        }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));

      expect(usersServiceMock.updateLastLogin).not.toHaveBeenCalled();
      expect(jwtServiceMock.signAsync).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when the password is incorrect', async () => {
      usersServiceMock.findByEmail.mockResolvedValue(activeAdmin);

      await expect(
        authService.login({
          email: activeAdmin.email,
          password: 'incorrect-password',
        }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));

      expect(usersServiceMock.updateLastLogin).not.toHaveBeenCalled();
      expect(jwtServiceMock.signAsync).not.toHaveBeenCalled();
    });

    it('should update lastLoginAt before generating the token', async () => {
      usersServiceMock.findByEmail.mockResolvedValue(activeAdmin);
      usersServiceMock.updateLastLogin.mockResolvedValue({
        ...activeAdmin,
        lastLoginAt: new Date(),
      });
      jwtServiceMock.signAsync.mockResolvedValue('signed-jwt-token');

      await authService.login({
        email: activeAdmin.email,
        password: 'valid-password',
      });

      const updateOrder =
        usersServiceMock.updateLastLogin.mock.invocationCallOrder[0];

      const tokenOrder = jwtServiceMock.signAsync.mock.invocationCallOrder[0];

      expect(updateOrder).toBeDefined();
      expect(tokenOrder).toBeDefined();
      expect(updateOrder).toBeLessThan(tokenOrder);
    });
  });
});
