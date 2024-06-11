import { Router } from "express";
import {
  SignUpUser,
  GenerateTasks,
  GettingTasks,
} from "../controller/user.controller";
import { presignedUrl } from "../controller/presignedUrl.controller";
import { AuthMiddleWare } from "../middleware/authMiddleware";

const router = Router();

router.route("/sign-up").post(SignUpUser);
router.route("/presignedUrl").get(AuthMiddleWare, presignedUrl);
router.route("/task").get(AuthMiddleWare, GettingTasks);
router.route("/task").post(AuthMiddleWare, GenerateTasks);

export default router;
