import "dotenv/config";
import express from "express";
import { connectDb } from "./db";
import healthRouter from "./routes/health";

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(express.json());
app.use(healthRouter);

connectDb()
  .then(() => {
    app.listen(PORT, () => console.log(`API listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  });
