import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import { ApiResponse } from "../utils/ApiResponse";
import { JWT_SECRET_FOR_WORKER } from "../index";
import { Request, Response } from "express";
import { number } from "zod";
import { createSubmissionTaskInput } from "../zodSchema/createTaskInput.zodSchema";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  Keypair,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

import { decode } from "bs58";
import nacl from "tweetnacl";

export const DECIMAL = 1000_000;

const prismaClient = new PrismaClient();
const connection = new Connection("https://api.devnet.solana.com/");
const MAX_SUBMISSIONS = 100;
export async function GetAnotherTask(userId: number) {
  const task = await prismaClient.task.findFirst({
    where: {
      done: false,

      submissions: {
        none: {
          worker_id: userId,
        },
      },
    },

    select: {
      id: true,
      amount: true,
      title: true,
      options: true,
    },
  });
  return task;
}

export async function SignUpWorkerUser(req: Request, res: Response) {
  const { publicKey, signature } = req.body;
  const message = new TextEncoder().encode(
    "Sign into mechanical turks as a Worker"
  );
  const result = nacl.sign.detached.verify(
    message,
    new Uint8Array(signature.data),
    new PublicKey(publicKey).toBytes()
  );
  if (!result) {
    return res.status(411).json({ message: "Message incorrect " });
  }

  const existingUser = await prismaClient.worker.findFirst({
    where: {
      address: publicKey,
    },
  });

  if (existingUser) {
    const token = jwt.sign(
      {
        userId: existingUser.id,
      },
      JWT_SECRET_FOR_WORKER
    );

    res.status(200).json({
      token,
      amount: existingUser.pending_amount / DECIMAL,
    });
  } else {
    const user = await prismaClient.worker.create({
      data: {
        address: publicKey,
        pending_amount: 0,
        locked_amount: 0,
      },
    });
    const token = jwt.sign(
      {
        userId: user.id,
      },
      JWT_SECRET_FOR_WORKER
    );
    res.status(200).json({
      token,
      amount: 0,
    });
  }
}

export async function getNextTask(req: Request, res: Response) {
  // @ts-ignore
  const userId: string = req.userId;

  const task = await GetAnotherTask(Number(userId));

  if (!task) {
    res
      .status(411)
      .json(new ApiResponse(411, "No more tasks is left for you "));
  } else {
    res
      .status(200)
      .json(new ApiResponse(200, task, "yee kaam kar ke dusra kaam milega "));
  }
}

export async function submitTask(req: Request, res: Response) {
  // @ts-ignore
  const userId = req.userId;
  const body = req.body;
  const parsedBody = createSubmissionTaskInput.safeParse(req.body);
  try {
    if (parsedBody.success) {
      const task = await GetAnotherTask(userId);
      const amount = (Number(task?.amount) / MAX_SUBMISSIONS).toString();
      if (!task || task?.id !== Number(parsedBody.data.taskId)) {
        res.status(411).json({ message: "the task id is incorrect" });
      }

      const submissions = await prismaClient.$transaction(async (el) => {
        const submission = await el.submission.create({
          data: {
            option_id: Number(parsedBody.data.selection),
            task_id: Number(parsedBody.data.taskId),
            worker_id: userId,
            amount: Number(amount),
          },
        });
        await el.worker.update({
          where: {
            id: userId,
          },
          data: {
            pending_amount: {
              increment: Number(amount),
            },
          },
        });
        return submission;
      });
      const nextTask = await GetAnotherTask(userId);

      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            { nextTask, amount },
            "ye leh pahele wale task ka  paisa garib sala !  aur naya task diya hai usko khatam kar "
          )
        );
    }
  } catch (error) {
    return res.status(411).json({ message: "incorrect input " });
  }
}

export async function GetWorkerPaymentBalance(req: Request, res: Response) {
  // @ts-ignore
  const userId = req.userId;
  try {
    const WorkerBalance = await prismaClient.worker.findFirst({
      where: {
        id: userId,
      },
      select: {
        locked_amount: true,
        pending_amount: true,
      },
    });
    res
      .status(200)
      .json(new ApiResponse(200, WorkerBalance, "ye dekh le tera paise "));
  } catch (error) {
    throw error;
  }
}

export async function WorkerPayout(req: Request, res: Response) {
  // @ts-ignore
  const userId = req.userId;

  const worker = await prismaClient.worker.findFirst({
    where: {
      id: userId,
    },
  });
  console.log(worker);
  if (!worker) {
    res.status(403).json({ message: "User not found " });
  }
  const address = worker?.address;
  if(worker?.pending_amount ==0){
    return res.status(500).json({message:"You can not take any amount because you haven't earned anything yet."})
  }
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: new PublicKey(process.env.PARENT_WALLET!),
      toPubkey: new PublicKey(worker?.address!),
      lamports: (1000_000_000 * worker?.pending_amount!) / DECIMAL,
    })
  );

  console.log(worker?.address);
  console.log(transaction);
  const keypair = Keypair.fromSecretKey(
    decode(process.env.SOLANA_PRIVATE_KEY!)
  );

  // TODO: There's a double spending problem here
  // The user can request the withdrawal multiple times
  // Can u figure out a way to fix it?
  let signature = "";
  try {
    signature = await sendAndConfirmTransaction(connection, transaction, [
      keypair,
    ]);
  } catch (e) {
    return res.json({
      message: "Transaction failed",
    });
  }

  await prismaClient.$transaction(async (tx) => {
    await tx.worker.update({
      where: {
        id: Number(userId),
      },
      data: {
        pending_amount: {
          decrement: worker?.pending_amount,
        },
        locked_amount: {
          increment: worker?.pending_amount,
        },
      },
    });

    await tx.payout.create({
      data: {
        user_id: Number(userId),
        amount: Number(worker?.pending_amount),
        status: "Processing",
        signature: signature,
      },
    });
  });

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { amount: worker?.pending_amount, lockedAmount: worker?.locked_amount },
        "Payment ho raha hai "
      )
    );
}
