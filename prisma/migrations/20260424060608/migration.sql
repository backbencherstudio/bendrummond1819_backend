/*
  Warnings:

  - You are about to drop the column `baseIncome` on the `incomes` table. All the data in the column will be lost.
  - You are about to drop the column `incomeType` on the `incomes` table. All the data in the column will be lost.
  - You are about to drop the column `payFrequency` on the `incomes` table. All the data in the column will be lost.
  - Added the required column `frequency` to the `financial_commitments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `income_type` to the `incomes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pay_frequency` to the `incomes` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `frequency` on the `savings_goals` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "financial_commitments" ADD COLUMN     "frequency" "PayFrequency" NOT NULL;

-- AlterTable
ALTER TABLE "incomes" DROP COLUMN "baseIncome",
DROP COLUMN "incomeType",
DROP COLUMN "payFrequency",
ADD COLUMN     "base_income" DECIMAL(65,30),
ADD COLUMN     "income_type" "IncomeType" NOT NULL,
ADD COLUMN     "pay_frequency" "PayFrequency" NOT NULL;

-- AlterTable
ALTER TABLE "savings_goals" DROP COLUMN "frequency",
ADD COLUMN     "frequency" "PayFrequency" NOT NULL;
