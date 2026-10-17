import { JwtStrategy } from './modules/auth/strategies/jwt.strategy';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { createHash } from 'crypto';
import { DashboardService } from './modules/admin/dashboard/dashboard.service';
import { DashboardController } from './modules/admin/dashboard/dashboard.controller';
import { PaymentTransactionService } from './modules/admin/payment-transaction/payment-transaction.service';
import { BillingHistoryController } from './modules/admin/payment-transaction/billing-history.controller';
import { BillingHistoryQueryDto } from './modules/admin/payment-transaction/dto/billing-history.dto';
import { AuthService } from './modules/auth/auth.service';
import { AuthController } from './modules/auth/auth.controller';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { LocalAuthGuard } from './modules/auth/guards/local-auth.guard';
import { RolesGuard } from './common/guard/role/roles.guard';
import { UserRepository } from './common/repository/user/user.repository';
import {
  ForgotPasswordDto,
  VerifyForgotPasswordOtpDto,
} from './modules/auth/dto/auth.dto';

jest.mock('./common/lib/Payment/stripe/StripePayment', () => ({
  StripePayment: {},
}));

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

describe('Registration chart', () => {
  afterEach(() => jest.useRealTimers());
  it('returns six UTC months across a year boundary, including zero counts', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-02-15T12:00:00Z'));
    const count = jest.fn().mockResolvedValue(0).mockResolvedValueOnce(3);
    const service = new DashboardService({ user: { count } } as any);
    const result = await service.registrationChart();
    expect(result.data.map((month) => month.month)).toEqual([
      '2025-09',
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
    expect(result.data.map((month) => month.registrations)).toEqual([
      3, 0, 0, 0, 0, 0,
    ]);
    expect(count.mock.calls[0][0].where).toEqual({
      type: 'user',
      deleted_at: null,
      created_at: { gte: new Date('2025-09-01Z'), lt: new Date('2025-10-01Z') },
    });
    expect(count.mock.calls[5][0].where.created_at.lt).toEqual(
      new Date('2026-02-15T12:00:00Z'),
    );
  });
});

describe('Billing history', () => {
  it('paginates, applies the same filters to rows and count, and returns decimal strings', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValue([
        { id: 'tx', amount: { toString: () => '29.99' }, paid_amount: null },
      ]);
    const count = jest.fn().mockResolvedValue(21);
    const prisma = {
      paymentTransaction: { findMany, count },
      $transaction: jest.fn((items) => Promise.all(items)),
    };
    const service = new PaymentTransactionService(prisma as any, null);
    const result = await service.billingHistory(
      Object.assign(new BillingHistoryQueryDto(), {
        page: 2,
        limit: 20,
        status: 'succeeded',
        q: 'alice',
        user_id: 'u1',
        from: '2026-10-01',
        to: '2026-11-01',
      }),
    );
    expect(result.pagination).toEqual({
      page: 2,
      limit: 20,
      total: 21,
      totalPages: 2,
    });
    expect(result.data[0]).toMatchObject({
      amount: '29.99',
      paid_amount: null,
    });
    const args = findMany.mock.calls[0][0];
    expect(args).toMatchObject({
      skip: 20,
      take: 20,
      where: { deleted_at: null, user_id: 'u1', status: 'succeeded' },
    });
    expect(args.where.OR).toHaveLength(4);
    expect(count.mock.calls[0][0].where).toEqual(args.where);
    expect(args.select.user.select).not.toHaveProperty('password');
  });
  it('rejects a reversed date range', async () => {
    const service = new PaymentTransactionService({} as any, null);
    await expect(
      service.billingHistory(
        Object.assign(new BillingHistoryQueryDto(), {
          from: '2026-11-01',
          to: '2026-10-01',
        }),
      ),
    ).rejects.toThrow(BadRequestException);
  });
  it.each([
    { limit: '101' },
    { page: '0' },
    { page: 'abc' },
    { from: '2026-02-30' },
  ])('rejects invalid query %p', async (query) => {
    await expect(
      pipe.transform(query, {
        type: 'query',
        metatype: BillingHistoryQueryDto,
      }),
    ).rejects.toThrow();
  });
});

describe('Email password reset', () => {
  let auth: AuthService;
  let prisma: any;
  let redis: any;
  let mail: any;
  let jwt: any;
  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'u1', name: 'Alice' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'u1' }),
        update: jest.fn().mockResolvedValue({ id: 'u1' }),
      },
    };
    redis = {
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      eval: jest.fn().mockResolvedValue('u1'),
      call: jest.fn().mockResolvedValue('u1'),
    };
    mail = { sendPasswordResetCode: jest.fn().mockResolvedValue(undefined) };
    jwt = {
      sign: jest.fn().mockReturnValue('reset-token'),
      verify: jest
        .fn()
        .mockReturnValue({ sub: 'u1', purpose: 'password-reset', jti: 'j1' }),
    };
    auth = new AuthService(jwt, prisma, mail, null, null, null, redis);
  });
  it('sends a reset code but stores only its hash with an expiry', async () => {
    const result = await auth.forgotPasswordByEmail(' ALICE@EXAMPLE.COM ');
    const sent = mail.sendPasswordResetCode.mock.calls[0][0];
    expect(sent.email).toBe('alice@example.com');
    expect(sent.otp).toMatch(/^\d{6}$/);
    const [key, value, mode, expiry] = redis.set.mock.calls[1];
    expect(key).not.toContain('alice@example.com');
    expect(JSON.parse(value)).toEqual({
      userId: 'u1',
      attempts: 0,
      hash: createHash('sha256').update(sent.otp).digest('hex'),
    });
    expect([mode, expiry]).toEqual(['EX', 600]);
    expect(JSON.stringify(result)).not.toContain(sent.otp);
    expect(result.data).not.toHaveProperty('userId');
  });
  it('returns the same response for an unknown email', async () => {
    const known = await auth.forgotPasswordByEmail('alice@example.com');
    prisma.user.findFirst.mockResolvedValue(null);
    mail.sendPasswordResetCode.mockClear();
    expect(await auth.forgotPasswordByEmail('unknown@example.com')).toEqual(
      known,
    );
    expect(mail.sendPasswordResetCode).not.toHaveBeenCalled();
  });
  it('honors the resend cooldown', async () => {
    redis.set.mockResolvedValue(null);
    await auth.forgotPasswordByEmail('alice@example.com');
    expect(mail.sendPasswordResetCode).not.toHaveBeenCalled();
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });
  it('cleans up the challenge when email queueing fails', async () => {
    mail.sendPasswordResetCode.mockRejectedValue(new Error('queue down'));
    await expect(
      auth.forgotPasswordByEmail('alice@example.com'),
    ).rejects.toThrow('Could not queue');
    expect(redis.del).toHaveBeenCalled();
  });
  it('issues a ten-minute single-use reset token after the code is consumed', async () => {
    const result = await auth.verifyEmailPasswordResetOtp(
      'alice@example.com',
      '123456',
    );
    expect(result.data.resetToken).toBe('reset-token');
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'u1',
        purpose: 'password-reset',
        jti: expect.any(String),
      }),
      { expiresIn: '10m' },
    );
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringContaining('password-reset:token:'),
      'u1',
      'EX',
      600,
    );
  });
  it('rejects missing, expired, exhausted or already-used OTP challenges', async () => {
    redis.eval.mockResolvedValue(null);
    await expect(
      auth.verifyEmailPasswordResetOtp('alice@example.com', '123456'),
    ).rejects.toThrow('Invalid or expired');
    expect(jwt.sign).not.toHaveBeenCalled();
  });
  it('rejects a challenge after the account email changes', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(
      auth.verifyEmailPasswordResetOtp('alice@example.com', '123456'),
    ).rejects.toThrow('Invalid password reset');
  });
  it('rejects reuse of a consumed email reset token', async () => {
    redis.call.mockResolvedValue(null);
    await expect(
      auth.resetPassword('reset-token', 'NewPassword123'),
    ).rejects.toThrow('already used');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
  it('resets the password and invalidates refresh tokens', async () => {
    await auth.resetPassword('reset-token', 'NewPassword123');
    expect(prisma.user.update.mock.calls[0][0].data.password).not.toBe(
      'NewPassword123',
    );
    expect(redis.del).toHaveBeenCalledWith('refresh_token:u1');
  });
  it('still accepts existing phone reset tokens', async () => {
    jwt.verify.mockReturnValue({ sub: 'u1', purpose: 'password-reset' });
    await auth.resetPassword('phone-reset-token', 'NewPassword123');
    expect(redis.call).not.toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalled();
  });
  it('rejects malformed email and OTP payloads', async () => {
    await expect(
      pipe.transform(
        { email: 'bad' },
        { type: 'body', metatype: ForgotPasswordDto },
      ),
    ).rejects.toThrow();
    await expect(
      pipe.transform(
        { email: 'a@example.com', code: 'abc' },
        { type: 'body', metatype: VerifyForgotPasswordOtpDto },
      ),
    ).rejects.toThrow();
  });
});

describe('Frontend HTTP and Swagger contract', () => {
  let app: any;
  const dashboard = {
    registrationChart: jest.fn().mockResolvedValue({ success: true, data: [] }),
  };
  const billing = {
    billingHistory: jest.fn().mockResolvedValue({
      success: true,
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    }),
  };
  const auth = {
    forgotPasswordByEmail: jest.fn().mockResolvedValue({ success: true }),
    forgotPassword: jest.fn().mockResolvedValue({ success: true }),
    verifyEmailPasswordResetOtp: jest.fn().mockResolvedValue({ success: true }),
    verifyForgotPasswordOtp: jest.fn().mockResolvedValue({ success: true }),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        DashboardController,
        BillingHistoryController,
        AuthController,
      ],
      providers: [
        Reflector,
        { provide: DashboardService, useValue: dashboard },
        { provide: PaymentTransactionService, useValue: billing },
        { provide: AuthService, useValue: auth },
        {
          provide: UserRepository,
          useValue: {
            getUserDetails: jest.fn(async (id) => ({
              type: id === 'admin' ? 'admin' : 'user',
            })),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context) => {
          const req = context.switchToHttp().getRequest();
          if (!req.headers.authorization) return false;
          req.user = {
            userId:
              req.headers.authorization === 'Bearer admin' ? 'admin' : 'user',
          };
          return true;
        },
      })
      .overrideGuard(LocalAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });
  afterAll(async () => app?.close());
  it('publishes the missing endpoints and response schemas in Swagger', () => {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    for (const path of [
      '/api/admin/dashboard/registration-chart',
      '/api/admin/billing-history',
      '/api/admin/transactions',
    ])
      expect(doc.paths[path].get).toBeDefined();
    expect(
      (doc.components.schemas.ForgotPasswordDto as { properties: object })
        .properties,
    ).toHaveProperty('email');
    expect(doc.components.schemas.BillingHistoryResponseDto).toBeDefined();
  });
  it.each([
    '/api/admin/dashboard/registration-chart',
    '/api/admin/billing-history',
    '/api/admin/transactions',
  ])('restricts %s to admins', async (path) => {
    await request(app.getHttpServer()).get(path).expect(403);
    await request(app.getHttpServer())
      .get(path)
      .set('Authorization', 'Bearer user')
      .expect(403);
    await request(app.getHttpServer())
      .get(path)
      .set('Authorization', 'Bearer admin')
      .expect(200);
  });
  it('validates billing query parameters over HTTP', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/billing-history?limit=101')
      .set('Authorization', 'Bearer admin')
      .expect(400);
  });
  it('dispatches both email and phone reset requests', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email: ' ALICE@EXAMPLE.COM ' })
      .expect(201);
    expect(auth.forgotPasswordByEmail).toHaveBeenCalledWith(
      'alice@example.com',
    );
    await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ phone: '+14155552671' })
      .expect(201);
    expect(auth.forgotPassword).toHaveBeenCalledWith('+14155552671');
    await request(app.getHttpServer())
      .post('/api/auth/forgot-password/verify-otp')
      .send({ email: 'alice@example.com', code: '123456' })
      .expect(201);
    expect(auth.verifyEmailPasswordResetOtp).toHaveBeenCalledWith(
      'alice@example.com',
      '123456',
    );
    await request(app.getHttpServer())
      .post('/api/auth/forgot-password/verify-otp')
      .send({ userId: 'u1', code: '123456' })
      .expect(201);
    expect(auth.verifyForgotPasswordOtp).toHaveBeenCalledWith('u1', '123456');
  });
  it.each([{}, { email: 'alice@example.com', phone: '+14155552671' }])(
    'requires exactly one reset contact %p',
    async (body) => {
      await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send(body)
        .expect(400);
    },
  );
});

describe('Password reset token isolation', () => {
  let strategy: JwtStrategy;
  const previousSecret = process.env.JWT_SECRET;
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-for-reset-token-isolation';
    strategy = new JwtStrategy();
  });
  afterAll(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  it('rejects password reset tokens as API access tokens', async () => {
    await expect(
      strategy.validate({ sub: 'u1', purpose: 'password-reset' }),
    ).rejects.toThrow('Invalid access token');
  });
  it('preserves ordinary access token authentication', async () => {
    await expect(strategy.validate({ sub: 'u1' })).resolves.toMatchObject({
      userId: 'u1',
    });
  });
});
