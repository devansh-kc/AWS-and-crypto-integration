import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET, JWT_SECRET_FOR_WORKER } from "..";
import { ApiResponse } from "../utils/ApiResponse";

export async function AuthMiddleWare(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const AuthHeader = req.headers["authorization"] ?? "";
    const userToken = jwt.verify(AuthHeader, JWT_SECRET);
    // @ts-ignore
    if (userToken?.userId) {
      // @ts-ignore

      req.userId = userToken.userId;
      return next();
    } else {
      return res
        .status(403)
        .json(
          new ApiResponse(
            403,
            "you are not logged in please log in using any crypto wallet "
          )
        );
    }
  } catch (error) {
    return res.status(403).json(new ApiResponse(403, error));
  }
}

export async function WorkerAuthMiddleWare(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const AuthHeader = req.headers["authorization"] ?? "";
    const userToken = jwt.verify(AuthHeader, JWT_SECRET_FOR_WORKER);
    // @ts-ignore
    if (userToken?.userId) {
      // @ts-ignore

      req.userId = userToken.userId;
      return next();
    } else {
      return res
        .status(403)
        .json(
          new ApiResponse(
            403,
            "you are not logged in please log in using any crypto wallet "
          )
        );
    }
  } catch (error) {
    return res.status(403).json(new ApiResponse(403, error));
  }
}
