-- DropForeignKey
ALTER TABLE "Payout" DROP CONSTRAINT "Payout_user_id_fkey";

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
