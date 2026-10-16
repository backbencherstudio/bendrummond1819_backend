import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client';
import {
  AdminSeedError,
  adminSeedConfig,
  adminSeedErrorMessage,
  seedAdmin,
} from '../src/command/admin-seed';

async function main() {
  adminSeedConfig(process.env);
  if (!process.env.DATABASE_URL)
    throw new AdminSeedError('DATABASE_URL is required');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    await seedAdmin(prisma, process.env);
    console.log(
      'Admin seed complete. Existing admin credentials are preserved.',
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  // Only known, safe diagnostics are printed; never raw database error payloads.
  console.error(`Admin seed failed: ${adminSeedErrorMessage(error)}`);
  process.exitCode = 1;
});
