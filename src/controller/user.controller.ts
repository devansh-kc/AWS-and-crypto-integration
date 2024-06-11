import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import nacl from "tweetnacl";
import { ApiResponse } from "../utils/ApiResponse";
import { JWT_SECRET } from "..";
import { Request, Response } from "express";
import { createTaskInput } from "../zodSchema/createTaskInput.zodSchema";
import { DECIMAL } from "./worker.controller";
import { PublicKey } from "@solana/web3.js";


const prismaClient = new PrismaClient();
export async function SignUpUser(req: Request, res: Response) {
  const { publicKey, signature } = req.body;
  const message = new TextEncoder().encode("Sign into mechanical turks");
  const result = nacl.sign.detached.verify(
    message,
    new Uint8Array(signature.data),
    new PublicKey(publicKey).toBytes(),
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
  const parsedData = createTaskInput.safeParse(body);

  // @ts-ignore
  const userId = req.userId;
  const defaultTitle = "Select one of the thing ";
  const defaultSignature = "default123456";
  if (!parsedData) {
    return res.status(411).json({ message: "You 've sent the wrong input " });
  }
  prismaClient.$transaction(async (tx) => {
    const response = await prismaClient.task.create({
      data: {
        title: parsedData.data?.title || defaultTitle,
        amount: 1 * DECIMAL,
        signature: parsedData.data?.signature || defaultSignature,
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
