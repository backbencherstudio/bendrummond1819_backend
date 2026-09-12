-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bill_remainders" BOOLEAN DEFAULT false,
ADD COLUMN     "notification_remainder" BOOLEAN DEFAULT false;
