import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import { ApiResponse } from "../utils/ApiResponse";
import { JWT_SECRET_FOR_WORKER } from "..";
import { Request, Response } from "express";
import { number } from "zod";
import { createSubmissionTaskInput } from "../zodSchema/createTaskInput.zodSchema";
import { error } from "console";

const prismaClient = new PrismaClient();
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
  const WalletToken = "sfnodsgnifdgifdgiuufdninfidbbiufdnawsd";
  const existingUser = await prismaClient.worker.findFirst({
    where: {
      address: WalletToken,
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
    });
  } else {
    const user = await prismaClient.worker.create({
      data: {
        address: WalletToken,
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

export const DECIMAL = 1000_000_000;
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
  if (!worker) {
    res.status(403).json({ message: "User not found " });
  }
  const address = worker?.address;
  const trnxId = "123456789789";

  const payouthandler = await prismaClient.$transaction(async (tx) => {
    await tx.worker.update({
      where: {
        id: userId,
      },
      data: {
        pending_amount: {
          decrement: worker?.pending_amount,
        },
      },
    });
    await tx.payout.create({
      data: {
        user_id: Number(userId),
        amount: Number(worker?.pending_amount),
        status: "Processing",
        signature: trnxId,
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
