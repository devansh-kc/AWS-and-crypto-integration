import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Request, Response } from "express";
import { ApiResponse } from "../utils/ApiResponse";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";

export async function presignedUrl(req: any, res: any) {
  try {
    const userID = req.userId;
    const client = new S3Client({
      credentials: {
        accessKeyId: process.env.AMAZON_S3_ACCESS_ID!,
        secretAccessKey: process.env.AMAZON_S3_SECRET_ACCESS_KEY!,
      },
      region: "ap-southeast-2",
    });

    const { url, fields } = await createPresignedPost(client, {
      Bucket: "devansh-cms",
      Key: `fiver/${userID}/${Math.random()}/image.jpg`,
      Conditions: [
        ["content-length-range", 0, 5 * 1024 * 1024], // 5 MB max
      ],
      Fields: {
        "Content-Type": "image/png",
      },

      Expires: 3600,
    });

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { url, fields },
          "presigned url generated successfully"
        )
      );
  } catch (error) {
    console.log(error);
    return res
      .status(400)
      .json(
        new ApiResponse(
          400,
          error,
          "something went wrong while generating presigned url"
        )
      );
  }
}
