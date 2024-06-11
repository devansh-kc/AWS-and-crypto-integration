import { Router } from "express";
import {
  SignUpWorkerUser,
  getNextTask,
  submitTask,
  GetWorkerPaymentBalance,
  WorkerPayout
} from "../controller/worker.controller";
import { WorkerAuthMiddleWare } from "../middleware/authMiddleware";
const router = Router();

export default router;

router.route("/sign-up").post(SignUpWorkerUser);
router.route("/next-task").get(WorkerAuthMiddleWare, getNextTask);
router.route("/submit-task").post(WorkerAuthMiddleWare, submitTask);
router.route("/balance").get(WorkerAuthMiddleWare, GetWorkerPaymentBalance);
router.route("/payout").post(WorkerAuthMiddleWare, WorkerPayout);
