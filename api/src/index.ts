import "dotenv/config";
import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import { connectDb } from "./db";
import healthRouter from "./routes/health";
import authRouter from "./routes/auth";
import providersRouter from "./routes/providers";

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(cors({
  origin: process.env.APP_URL ?? "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(healthRouter);
app.use(authRouter);
app.use(providersRouter);

connectDb()
  .then(() => {
    app.listen(PORT, () => console.log(`API listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  });
