
import "dotenv/config";
import dns from "node:dns";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { toNodeHandler } from "better-auth/node";
import { connectDB } from "./config/db.js";
import { auth } from "./lib/auth.js";
import studioRoutes from "./routes/studio.routes.js";

// MongoDB Atlas DNS configuration
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// CORS configuration
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.use(cookieParser());

// BetterAuth routes
app.all("/api/auth/{*any}", toNodeHandler(auth));

// JSON middleware
app.use(express.json());

// Studio routes
app.use("/api/studios", studioRoutes);

// Health check
app.get("/", (_req, res) => {
  res.status(200).json({
    message: "StudioSpace API is running",
  });
});

// Start server
async function startServer() {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(
        `StudioSpace server running on http://localhost:${PORT}`
      );

      console.log(
        `BetterAuth running at http://localhost:${PORT}/api/auth`
      );

      console.log(
        `Studio API running at http://localhost:${PORT}/api/studios`
      );
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

void startServer();
