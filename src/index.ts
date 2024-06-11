import express from "express";
import userRouter from "./routes/user.route";
import workerRoute from "./routes/worker.route";
import cors from "cors";
const app = express();
const port = 8000;

export const JWT_SECRET = "kfndkfnkdnkdngkn";
export const JWT_SECRET_FOR_WORKER ="qweeefdsvfdvfdgfdbfd"

app.use(express.json());
app.use(cors());

app.listen(port || 3000, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});

// Routes declaration
app.use("/v1/user", userRouter);

app.use("/v1/worker", workerRoute);
