/*
  Warnings:

  - You are about to drop the column `Title` on the `Task` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Task" DROP COLUMN "Title",
ADD COLUMN     "title" TEXT NOT NULL DEFAULT 'select the most clickable  thumbnail';
