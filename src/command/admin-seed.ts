import { isEmail } from 'class-validator';
import * as bcrypt from 'bcrypt';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import type { PrismaClient } from '../../prisma/generated/client';

export class AdminSeedError extends Error {}

export function adminSeedErrorMessage(error: unknown): string {
  if (error instanceof AdminSeedError) return error.message;
  const code = (error as { code?: string } | null)?.code;
  const messages: Record<string, string> = {
    P1000: 'Database authentication failed. Check DATABASE_URL credentials.',
    P1001:
      'Cannot reach the database. Check DATABASE_URL and that PostgreSQL is running.',
    P1003: 'The configured database does not exist. Create it before seeding.',
    P1010: 'Database access denied. Check the database user permissions.',
    P2021:
      'A required database table is missing. Run prisma migrate deploy before seeding.',
    P2022:
      'A required database column is missing. Run prisma migrate deploy and prisma generate before seeding.',
    P2002:
      'A unique account field is already in use. Check the existing admin account.',
  };
  return (
    messages[code ?? ''] ??
    'Database seed failed. Check database connectivity, migrations and the generated Prisma client.'
  );
}

export function adminSeedConfig(env: NodeJS.ProcessEnv) {
  const email = (env.ADMIN_EMAIL ?? env.SYSTEM_EMAIL ?? '')
    .trim()
    .toLowerCase();
  const password = env.ADMIN_PASSWORD ?? env.SYSTEM_PASSWORD ?? '';
  const name = (env.ADMIN_NAME ?? 'Admin').trim();
  const rawPhone = (env.ADMIN_PHONE ?? env.SYSTEM_PHONE ?? '').trim();
  const phone = rawPhone.startsWith('+')
    ? parsePhoneNumberFromString(rawPhone)
    : undefined;
  if (!phone?.isValid())
    throw new AdminSeedError(
      'Set ADMIN_PHONE to a valid international phone number including + and country code',
    );
  if (email && !isEmail(email))
    throw new AdminSeedError('Set ADMIN_EMAIL to a valid admin email address');
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new AdminSeedError(
      'ADMIN_PASSWORD (or fallback SYSTEM_PASSWORD) must have at least 8 characters and at most 72 UTF-8 bytes. Set ADMIN_PASSWORD in .env.',
    );
  }
  if (!name || name.length > 255)
    throw new AdminSeedError('ADMIN_NAME must contain 1 to 255 characters');
  return { email: email || undefined, password, name, phone: phone.number };
}

export async function seedAdmin(prisma: PrismaClient, env: NodeJS.ProcessEnv) {
  const { email, password, name, phone } = adminSeedConfig(env);
  return prisma.$transaction(async (tx) => {
    const accounts = await tx.user.findMany({
      where: { OR: [{ phone_number: phone }, ...(email ? [{ email }] : [])] },
      select: {
        id: true,
        type: true,
        status: true,
        deleted_at: true,
        phone_number: true,
        email: true,
      },
    });
    if (accounts.length > 1) {
      throw new AdminSeedError(
        'ADMIN_PHONE and ADMIN_EMAIL belong to different accounts. Choose matching admin credentials.',
      );
    }
    const current = accounts[0];
    if (
      current &&
      (current.type !== 'admin' || current.deleted_at || current.status !== 1)
    ) {
      throw new AdminSeedError(
        'The seed phone or email belongs to an existing non-admin or inactive account; choose another ADMIN_PHONE or ADMIN_EMAIL',
      );
    }
    if (current?.phone_number && current.phone_number !== phone) {
      throw new AdminSeedError(
        'This admin already has a different phone number. Use its current ADMIN_PHONE.',
      );
    }
    if (current) {
      // Upgrade an earlier email-only admin without resetting its password.
      await tx.user.update({
        where: { id: current.id },
        data: { phone_number: phone, phone_verified_at: new Date() },
        select: { id: true },
      });
      return { id: current.id };
    }
    return tx.user.create({
      data: {
        email,
        name,
        phone_number: phone,
        password: await bcrypt.hash(password, 10),
        type: 'admin',
        status: 1,
        approval_status: 'approved',
        approved_at: new Date(),
        email_verified_at: email ? new Date() : undefined,
        phone_verified_at: new Date(),
      },
      select: { id: true },
    });
  });
}
