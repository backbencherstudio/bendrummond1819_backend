import { AuthService } from './auth.service';

jest.mock('../../common/lib/Payment/stripe/StripePayment', () => ({
  StripePayment: {},
}));

describe('Login payment status', () => {
  let service: AuthService;
  let prisma: any;
  let repository: any;
  let jwt: any;
  let redis: any;

  beforeEach(() => {
    prisma = {
      paymentTransaction: { findFirst: jest.fn() },
      user: { update: jest.fn().mockResolvedValue({ id: 'user-1' }) },
    };
    repository = {
      getUserDetails: jest
        .fn()
        .mockResolvedValue({ id: 'user-1', type: 'user' }),
    };
    jwt = { sign: jest.fn().mockReturnValue('token') };
    redis = { set: jest.fn().mockResolvedValue('OK') };
    service = new AuthService(jwt, prisma, null, repository, null, null, redis);
  });

  it.each([
    [{ id: 'payment-1' }, true],
    [null, false],
  ])('returns payment status %p as %p in login', async (payment, expected) => {
    prisma.paymentTransaction.findFirst.mockResolvedValue(payment);
    const result = await service.login({ userId: 'user-1' });
    expect(result.isPaymentComplete).toBe(expected);
    expect(result.authorization).toMatchObject({
      access_token: 'token',
      refresh_token: 'token',
    });
    expect(prisma.paymentTransaction.findFirst).toHaveBeenCalledWith({
      where: { user_id: 'user-1', status: 'succeeded', deleted_at: null },
      select: { id: true },
    });
  });

  it('does not check payments for a missing user', async () => {
    repository.getUserDetails.mockResolvedValue(null);
    await expect(service.login({ userId: 'missing' })).rejects.toThrow(
      'User not found',
    );
    expect(prisma.paymentTransaction.findFirst).not.toHaveBeenCalled();
  });

  it('propagates payment lookup errors instead of reporting an unpaid user', async () => {
    prisma.paymentTransaction.findFirst.mockRejectedValue(
      new Error('Database unavailable'),
    );
    await expect(service.login({ userId: 'user-1' })).rejects.toThrow(
      'Database unavailable',
    );
    expect(jwt.sign).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });
});
