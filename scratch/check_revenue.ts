import { PrismaService } from 'src/prisma/prisma.service';

async function check() {
  const prisma = new PrismaService();
  const transactions = await prisma.paymentTransaction.findMany();
  console.log('Total transactions:', transactions.length);
  console.log(
    'Transactions statuses:',
    transactions.map((t) => t.status),
  );
  console.log(
    'Total revenue (succeeded):',
    transactions
      .filter((t) => t.status === 'succeeded')
      .reduce((acc, t) => acc + Number(t.amount || 0), 0),
  );

  const activeSubs = await prisma.subscription.findMany({
    where: { status: 'active' },
    include: { plan: true },
  });
  console.log('Active subscriptions:', activeSubs.length);
  console.log(
    'Active sub prices:',
    activeSubs.map((s) => s.plan.price),
  );

  await prisma.$disconnect();
}

check();
