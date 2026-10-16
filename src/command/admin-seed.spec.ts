import {
  AdminSeedError,
  adminSeedConfig,
  adminSeedErrorMessage,
  seedAdmin,
} from './admin-seed';
import * as bcrypt from 'bcrypt';

const env = {
  ADMIN_PHONE: '+1 415 555 2671',
  ADMIN_EMAIL: ' ADMIN@EXAMPLE.COM ',
  ADMIN_PASSWORD: 'test-password',
};
const admin = {
  id: 'a1',
  type: 'admin',
  status: 1,
  deleted_at: null,
  phone_number: '+14155552671',
  email: 'admin@example.com',
};
function mockDatabase(accounts: object[] = []) {
  const tx = {
    user: {
      findMany: jest.fn().mockResolvedValue(accounts),
      create: jest.fn().mockResolvedValue({ id: 'a1' }),
      update: jest.fn().mockResolvedValue({ id: 'a1' }),
    },
  };
  return {
    tx,
    prisma: { $transaction: jest.fn((callback) => callback(tx)) } as any,
  };
}

describe('Phone admin seed', () => {
  it('normalizes phone and email', () => {
    expect(adminSeedConfig(env)).toMatchObject({
      phone: '+14155552671',
      email: 'admin@example.com',
    });
  });
  it('supports SYSTEM fallbacks and optional email', () => {
    expect(
      adminSeedConfig({
        SYSTEM_PHONE: env.ADMIN_PHONE,
        SYSTEM_PASSWORD: env.ADMIN_PASSWORD,
      }),
    ).toMatchObject({ phone: '+14155552671', email: undefined });
  });
  it.each([
    { ...env, ADMIN_PHONE: '' },
    { ...env, ADMIN_PHONE: '123' },
    { ...env, ADMIN_PHONE: '4155552671' },
    { ...env, ADMIN_EMAIL: 'bad' },
    { ...env, ADMIN_PASSWORD: 'short' },
    { ...env, ADMIN_PASSWORD: 'é'.repeat(37) },
  ])('rejects invalid config before connecting %p', async (input) => {
    const { prisma } = mockDatabase();
    await expect(seedAdmin(prisma, input)).rejects.toThrow(AdminSeedError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('creates a phone-verified admin with a hashed password', async () => {
    const { prisma, tx } = mockDatabase();
    expect(await seedAdmin(prisma, env)).toEqual({ id: 'a1' });
    const data = tx.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      phone_number: '+14155552671',
      type: 'admin',
      approval_status: 'approved',
    });
    expect(data.phone_verified_at).toBeInstanceOf(Date);
    expect(await bcrypt.compare(env.ADMIN_PASSWORD, data.password)).toBe(true);
  });
  it.each([admin, { ...admin, phone_number: null }])(
    'reruns and upgrades email-only admins without resetting passwords %p',
    async (account) => {
      const { prisma, tx } = mockDatabase([account]);
      await seedAdmin(prisma, env);
      expect(tx.user.create).not.toHaveBeenCalled();
      expect(tx.user.update.mock.calls[0][0].data).toEqual({
        phone_number: '+14155552671',
        phone_verified_at: expect.any(Date),
      });
    },
  );
  it.each([
    [{ ...admin, type: 'user' }],
    [{ ...admin, status: 0 }],
    [{ ...admin, deleted_at: new Date() }],
    [{ ...admin, phone_number: '+447911123456' }],
    [admin, { ...admin, id: 'a2' }],
  ])('rejects conflicting or ineligible accounts %p', async (...accounts) => {
    const { prisma, tx } = mockDatabase(accounts);
    await expect(seedAdmin(prisma, env)).rejects.toThrow(AdminSeedError);
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.user.create).not.toHaveBeenCalled();
  });
  it('prints known diagnostics and hides unexpected sensitive errors', () => {
    expect(adminSeedErrorMessage(new AdminSeedError('Set ADMIN_PHONE'))).toBe(
      'Set ADMIN_PHONE',
    );
    expect(adminSeedErrorMessage({ code: 'P2022' })).toContain(
      'prisma migrate deploy',
    );
    expect(adminSeedErrorMessage(new Error('secret'))).not.toContain('secret');
  });
});
