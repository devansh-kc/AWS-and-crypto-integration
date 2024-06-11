/*
  Warnings:

  - The `image_url` column on the `Option` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Option" DROP COLUMN "image_url",
ADD COLUMN     "image_url" TEXT[];

-- AlterTable
ALTER TABLE "Task" ALTER COLUMN "title" DROP NOT NULL;
