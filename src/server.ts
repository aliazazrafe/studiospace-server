
import "dotenv/config";
import dns from "node:dns";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { toNodeHandler } from "better-auth/node";
import { connectDB } from "./config/db.js";
import { auth } from "./lib/auth.js";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.use(cookieParser());

// BetterAuth route
app.all("/api/auth/{*any}", toNodeHandler(auth));

app.use(express.json());

app.get("/", (_req, res) => {
  res.status(200).json({
    message: "StudioSpace API is running",
  });
});

async function startServer() {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`StudioSpace server running on http://localhost:${PORT}`);
      console.log(`BetterAuth running at http://localhost:${PORT}/api/auth`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

void startServer();
