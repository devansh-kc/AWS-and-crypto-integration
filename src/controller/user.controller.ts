import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import nacl from "tweetnacl";
import { ApiResponse } from "../utils/ApiResponse";
import { JWT_SECRET } from "..";
import { Request, Response } from "express";
import { createTaskInput } from "../zodSchema/createTaskInput.zodSchema";
import { DECIMAL } from "./worker.controller";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";

const connection = new Connection("https://api.devnet.solana.com/");
const PARENT_WALLET_ADDRESS = process.env.PARENT_WALLET;

const prismaClient = new PrismaClient();
export async function SignUpUser(req: Request, res: Response) {
  const { publicKey, signature } = req.body;
  const message = new TextEncoder().encode("Sign into mechanical turks");
  const result = nacl.sign.detached.verify(
    message,
    new Uint8Array(signature.data),
    new PublicKey(publicKey).toBytes()
  );

  const existingUser = await prismaClient.user.findFirst({
    where: {
      address: publicKey,
    },
  });

  if (existingUser) {
    const token = jwt.sign(
      {
        userId: existingUser.id,
      },
      JWT_SECRET
    );

    res.status(200).json({
      token,
    });
  } else {
    const user = await prismaClient.user.create({
      data: {
        address: publicKey,
      },
    });
    const token = jwt.sign(
      {
        userId: user.id,
      },
      JWT_SECRET
    );
    res.status(200).json({
      token,
    });
  }
}

export async function GenerateTasks(req: Request, res: Response) {
  const body = req.body;
  // @ts-ignore
  const userId = req.userId;

  const parsedData = createTaskInput.safeParse(body);
  console.log(parsedData);
  const user = await prismaClient.user.findFirst({
    where: {
      id: userId,
    },
  });

  if (!parsedData.success) {
    return res.status(411).json({ message: "You 've sent the wrong input " });
  }
  const transaction = await connection.getTransaction(
    parsedData.data.signature,
    {
      maxSupportedTransactionVersion: 1,
    }
  );
  const postbalance = transaction?.meta?.postBalances[0]!;
  const preBalance = transaction?.meta?.preBalances[0]!;

  console.log(transaction);
  if (
    transaction?.transaction.message.getAccountKeys().get(0)?.toString() !==
    user?.address
  ) {
    return res.status(411).json({
      message: "Transaction sent to wrong address",
    });
  }

  if (
    transaction?.transaction.message.getAccountKeys().get(0)?.toString() !==
    PARENT_WALLET_ADDRESS!
  ) {
    return res.status(411).json({
      message: "Transaction sent to wrong address",
    });
  }

  // if (
  //   (transaction?.meta?.postBalances[1] ?? 0) -
  //     (transaction?.meta?.preBalances[1] ?? 0) !==
  //   100000000
  // ) {
  //   return res.status(411).json({
  //     message: "Transaction signature/amount incorrect",
  //   });
  // }

  prismaClient.$transaction(async (tx) => {
    const response = await prismaClient.task.create({
      data: {
        title: parsedData.data?.title,
        amount: 1 * DECIMAL,
        signature: parsedData.data?.signature!,
        user_id: userId,
      },
    });
    if (!parsedData.data?.options) {
      return res
        .status(404)
        .json({ message: " you haven't provided options " });
    } else {
      await tx.option.createMany({
        data: parsedData.data.options.map((x) => ({
          image_url: x.imageUrl,
          task_id: response.id,
        })),
      });

      return res.status(200).json({ message: response.id });
    }
  });
}

export async function GettingTasks(req: Request, res: Response) {
  // @ts-ignore
  const taskId: string = req.query.taskId;
  // @ts-ignore
  const userId: string = req.userId;
  const taskDetails = await prismaClient.task.findFirst({
    where: {
      user_id: Number(userId),
      id: Number(taskId),
    },
    include: {
      options: true,
    },
  });
  if (!taskDetails) {
    return res.status(411).json({
      message: "you do not have access to this table ",
    });
  }
  const response = await prismaClient.submission.findMany({
    where: {
      task_id: Number(taskId),
    },
    include: {
      option: true,
    },
  });
  const result: Record<
    string,
    {
      count: number;
      option: { imageUrl: string };
    }
  > = {};
  taskDetails.options.forEach((option) => {
    result[option.id] = {
      count: 0,
      option: {
        imageUrl: option.image_url,
      },
    };
  });
  response.forEach((e) => {
    result[e.option_id].count++;
  });
  res.status(200).json(new ApiResponse(200, { taskDetails, result }));
}
